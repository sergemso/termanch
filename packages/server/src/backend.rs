//! Where sessions live. The server only needs four things from a session manager: list them, create one,
//! name the command that attaches a terminal to one, and survive a client detaching. tmux is built in;
//! anything with a CLI that fits that shape (herdr, zellij, screen, ...) plugs in through `CommandBackend`;
//! a server-native backend can implement `SessionBackend` directly (plan step 7.1).
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use termanch_core::protocol::SessionInfo;
use tokio::process::Command;

use crate::pty::Attachment;

#[async_trait]
pub trait SessionBackend: Send + Sync {
    fn name(&self) -> &str;
    async fn list(&self) -> Result<Vec<SessionInfo>>;
    async fn create(&self, name: &str) -> Result<()>;
    /// Starts a terminal attached to session `id`. Dropping it must only detach.
    fn attach(&self, id: &str, cols: u16, rows: u16) -> Result<Attachment>;
}

/// Session ids/names we accept from clients; they end up in argv, never in a shell.
pub fn valid_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 64
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

/// One session per line: `id` or `id|name|...`; extra fields are ignored.
pub fn parse_list(output: &str) -> Vec<SessionInfo> {
    output
        .lines()
        .filter_map(|line| {
            let mut fields = line.split('|').map(str::trim);
            let id = fields.next().filter(|id| !id.is_empty())?;
            let name = fields.next().filter(|n| !n.is_empty()).unwrap_or(id);
            Some(SessionInfo {
                id: id.to_string(),
                name: name.to_string(),
                agent: None,
            })
        })
        .collect()
}

/// Where session commands run (DECISION-0058). In container mode they run as-is. In host mode every command
/// is prefixed with `nsenter` into PID 1's namespaces (the container has `--pid=host --privileged`), and
/// for a dedicated user also with `runuser`, so tmux and the agent CLIs are the host's own.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Runner {
    /// `nsenter ...`; empty in container mode.
    enter: Vec<String>,
    /// `runuser -u <user> --` for a dedicated user; empty for root and in container mode.
    user: Vec<String>,
}

/// Runs the rest of the command line in its own transient systemd scope when the host has systemd, so a
/// process started this way (the tmux server) is not in the container's cgroup and survives the
/// container being restarted or updated. Without systemd it runs the command directly.
const DETACH: [&str; 4] = [
    "sh",
    "-c",
    "if command -v systemd-run >/dev/null 2>&1; then exec systemd-run --scope --quiet -- \"$@\"; fi; exec \"$@\"",
    "sh",
];

impl Runner {
    /// `user` is `root` or the name of an unprivileged host user.
    pub fn host(user: &str) -> Self {
        let enter = ["nsenter", "-t", "1", "-m", "-u", "-i", "-n", "-p"]
            .map(String::from)
            .to_vec();
        let user = if user == "root" {
            vec![]
        } else {
            ["runuser", "-u", user, "--"].map(String::from).to_vec()
        };
        Self { enter, user }
    }

    /// The program and arguments to actually execute for `program args`. `detach` is for commands that
    /// start a long-lived server (tmux new-session).
    pub fn wrap(&self, detach: bool, program: &str, args: &[String]) -> (String, Vec<String>) {
        let mut argv: Vec<String> = self.enter.clone();
        if detach && !self.enter.is_empty() {
            argv.extend(DETACH.iter().map(|s| s.to_string()));
        }
        argv.extend(self.user.iter().cloned());
        argv.push(program.to_string());
        argv.extend(args.iter().cloned());
        let first = argv.remove(0);
        (first, argv)
    }

    async fn run(&self, program: &str, args: &[String]) -> Result<std::process::Output> {
        self.run_as(false, program, args).await
    }

    async fn run_as(
        &self,
        detach: bool,
        program: &str,
        args: &[String],
    ) -> Result<std::process::Output> {
        let (program, args) = self.wrap(detach, program, args);
        Command::new(&program)
            .args(&args)
            .envs(crate::locale::utf8_env())
            .output()
            .await
            .map_err(|e| anyhow!("cannot run {program}: {e}"))
    }

    fn attach(&self, program: &str, args: &[String], cols: u16, rows: u16) -> Result<Attachment> {
        let (program, args) = self.wrap(false, program, args);
        Attachment::spawn(&program, &args, cols, rows)
    }

    /// Startup self-check for the native mode: this process must run as the chosen user and tmux must exist.
    pub async fn check_native(&self, want_root: bool) -> Result<()> {
        let out = self.run("id", &["-u".to_string()]).await?;
        let uid = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if want_root != (uid == "0") {
            return Err(anyhow!(
                "the service runs as uid {uid}, not as the {} you chose; check User= in the systemd unit",
                if want_root { "root user" } else { "dedicated user" }
            ));
        }
        let tmux = self.run("tmux", &["-V".to_string()]).await;
        if !tmux.map(|o| o.status.success()).unwrap_or(false) {
            return Err(anyhow!("tmux is not installed on this machine"));
        }
        Ok(())
    }

    /// Startup self-check for host mode: the prefix must work, run as the chosen user, and find tmux.
    pub async fn check_host(&self, want_root: bool) -> Result<()> {
        let out = self.run("id", &["-u".to_string()]).await.map_err(|e| {
            anyhow!("host mode could not run commands on the host ({e}); start the container with --pid=host --privileged")
        })?;
        if !out.status.success() {
            return Err(anyhow!(
                "host mode could not run commands on the host: {}; start the container with --pid=host --privileged and check that the user exists",
                String::from_utf8_lossy(&out.stderr).trim()
            ));
        }
        let uid = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if want_root != (uid == "0") {
            return Err(anyhow!(
                "host sessions run as uid {uid}, not as the {} you chose",
                if want_root {
                    "root user"
                } else {
                    "dedicated user"
                }
            ));
        }
        let tmux = self.run("tmux", &["-V".to_string()]).await;
        if !tmux.map(|o| o.status.success()).unwrap_or(false) {
            return Err(anyhow!("tmux is not installed on the host"));
        }
        Ok(())
    }
}

/// Chosen at install and fixed for the life of the container; no message or update can change it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RunMode {
    Container,
    /// `user` is `root` or the dedicated unprivileged user.
    Host {
        user: String,
    },
    /// The server itself runs on the host as `user` (decision 0075): commands run as they are, with no `nsenter`.
    Native {
        user: String,
    },
}

impl RunMode {
    pub fn parse(run: &str, user: &str) -> Result<Self> {
        match run {
            "container" => Ok(Self::Container),
            "host" if user.is_empty() => Err(anyhow!("TERMANCH_RUN_USER must name a user or root")),
            "host" => Ok(Self::Host {
                user: user.to_string(),
            }),
            "native" if user.is_empty() => {
                Err(anyhow!("TERMANCH_RUN_USER must name a user or root"))
            }
            "native" => Ok(Self::Native {
                user: user.to_string(),
            }),
            other => Err(anyhow!(
                "unknown TERMANCH_RUN `{other}` (container, host or native)"
            )),
        }
    }

    /// Shown to the owner in the app and written in audit entries.
    pub fn label(&self) -> String {
        match self {
            Self::Container => "container".into(),
            // The app shows the same badge for both ways of running on the host.
            Self::Host { user } | Self::Native { user } => format!("host:{user}"),
        }
    }

    pub fn is_host(&self) -> bool {
        matches!(self, Self::Host { .. } | Self::Native { .. })
    }

    pub fn runner(&self) -> Runner {
        match self {
            Self::Container => Runner::default(),
            Self::Host { user } => Runner::host(user),
            Self::Native { .. } => Runner::default(),
        }
    }

    pub async fn self_check(&self) -> Result<()> {
        match self {
            Self::Container => Ok(()),
            Self::Host { user } => self.runner().check_host(user == "root").await,
            Self::Native { user } => Runner::default().check_native(user == "root").await,
        }
    }
}

#[derive(Default)]
pub struct TmuxBackend {
    runner: Runner,
}

impl TmuxBackend {
    pub fn new(runner: Runner) -> Self {
        Self { runner }
    }
}

#[async_trait]
impl SessionBackend for TmuxBackend {
    fn name(&self) -> &str {
        "tmux"
    }

    async fn list(&self) -> Result<Vec<SessionInfo>> {
        let args = ["list-sessions", "-F", "#{session_name}|#{session_name}"].map(String::from);
        let out = self.runner.run("tmux", &args).await?;
        if !out.status.success() {
            let stderr = String::from_utf8_lossy(&out.stderr);
            // No server yet simply means no sessions.
            if stderr.contains("no server running") || stderr.contains("No such file") {
                return Ok(vec![]);
            }
            return Err(anyhow!("tmux list-sessions failed: {}", stderr.trim()));
        }
        Ok(parse_list(&String::from_utf8_lossy(&out.stdout)))
    }

    async fn create(&self, name: &str) -> Result<()> {
        if !valid_name(name) {
            return Err(anyhow!(
                "Session names use letters, digits, - and _ (max 64)"
            ));
        }
        let args = ["new-session", "-d", "-s", name].map(String::from);
        let out = self.runner.run_as(true, "tmux", &args).await?;
        if !out.status.success() {
            return Err(anyhow!(
                "tmux new-session failed: {}",
                String::from_utf8_lossy(&out.stderr).trim()
            ));
        }
        Ok(())
    }

    fn attach(&self, id: &str, cols: u16, rows: u16) -> Result<Attachment> {
        if !valid_name(id) {
            return Err(anyhow!("Unknown session"));
        }
        // `=` makes the target an exact name match.
        let args = ["attach-session", "-t", &format!("={id}")].map(String::from);
        self.runner.attach("tmux", &args, cols, rows)
    }
}

/// Any session manager driven by three command lines (no shell; split on spaces).
/// `{id}` and `{name}` in an argument are replaced by the validated session id/name.
/// list prints one session per line (`id` or `id|name`); create makes a detached session;
/// attach runs in a PTY and must repaint the session when it starts and only detach when killed.
pub struct CommandBackend {
    label: String,
    list: Vec<String>,
    create: Vec<String>,
    attach: Vec<String>,
    runner: Runner,
}

impl CommandBackend {
    #[cfg(test)]
    pub fn new(label: &str, list: &str, create: &str, attach: &str) -> Result<Self> {
        Self::with_runner(label, list, create, attach, Runner::default())
    }

    pub fn with_runner(
        label: &str,
        list: &str,
        create: &str,
        attach: &str,
        runner: Runner,
    ) -> Result<Self> {
        let split = |s: &str| s.split_whitespace().map(String::from).collect::<Vec<_>>();
        let backend = Self {
            label: label.to_string(),
            list: split(list),
            create: split(create),
            attach: split(attach),
            runner,
        };
        for (what, cmd) in [
            ("list", &backend.list),
            ("create", &backend.create),
            ("attach", &backend.attach),
        ] {
            if cmd.is_empty() {
                return Err(anyhow!("backend command `{what}` is empty"));
            }
        }
        Ok(backend)
    }

    fn fill(template: &[String], id: &str) -> Vec<String> {
        template
            .iter()
            .map(|a| a.replace("{id}", id).replace("{name}", id))
            .collect()
    }
}

#[async_trait]
impl SessionBackend for CommandBackend {
    fn name(&self) -> &str {
        &self.label
    }

    async fn list(&self) -> Result<Vec<SessionInfo>> {
        let out = self.runner.run(&self.list[0], &self.list[1..]).await?;
        if !out.status.success() {
            return Err(anyhow!(
                "{} list failed: {}",
                self.label,
                String::from_utf8_lossy(&out.stderr).trim()
            ));
        }
        Ok(parse_list(&String::from_utf8_lossy(&out.stdout))
            .into_iter()
            .filter(|s| valid_name(&s.id))
            .collect())
    }

    async fn create(&self, name: &str) -> Result<()> {
        if !valid_name(name) {
            return Err(anyhow!(
                "Session names use letters, digits, - and _ (max 64)"
            ));
        }
        let argv = Self::fill(&self.create, name);
        let out = self.runner.run_as(true, &argv[0], &argv[1..]).await?;
        if !out.status.success() {
            return Err(anyhow!(
                "{} create failed: {}",
                self.label,
                String::from_utf8_lossy(&out.stderr).trim()
            ));
        }
        Ok(())
    }

    fn attach(&self, id: &str, cols: u16, rows: u16) -> Result<Attachment> {
        if !valid_name(id) {
            return Err(anyhow!("Unknown session"));
        }
        let argv = Self::fill(&self.attach, id);
        self.runner.attach(&argv[0], &argv[1..], cols, rows)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_session_lines() {
        let infos = parse_list("main|Main one\nwork\n\n|x\n");
        assert_eq!(
            infos
                .iter()
                .map(|i| (i.id.as_str(), i.name.as_str()))
                .collect::<Vec<_>>(),
            [("main", "Main one"), ("work", "work")]
        );
    }

    #[test]
    fn rejects_unsafe_names() {
        assert!(valid_name("agent-1_a"));
        assert!(!valid_name(""));
        assert!(!valid_name("a b"));
        assert!(!valid_name("a:b"));
        assert!(!valid_name("=x"));
        assert!(!valid_name("a;rm"));
        assert!(!valid_name(&"a".repeat(65)));
    }

    #[test]
    fn the_native_mode_runs_commands_as_they_are_and_shows_the_host_badge() {
        let native = RunMode::parse("native", "termanch").unwrap();
        assert_eq!(native.label(), "host:termanch");
        assert!(native.is_host());
        let (prog, argv) = native
            .runner()
            .wrap(true, "tmux", &["new-session".to_string()]);
        assert_eq!(
            (prog.as_str(), argv),
            ("tmux", vec!["new-session".to_string()]),
            "no nsenter, no wrapper"
        );
        assert!(RunMode::parse("native", "").is_err());
    }

    #[test]
    fn run_modes_parse_and_default_to_the_container() {
        assert_eq!(
            RunMode::parse("container", "termanch").unwrap(),
            RunMode::Container
        );
        let host = RunMode::parse("host", "root").unwrap();
        assert_eq!((host.label().as_str(), host.is_host()), ("host:root", true));
        assert_eq!(RunMode::Container.label(), "container");
        assert!(RunMode::parse("host", "").is_err());
        assert!(RunMode::parse("vm", "x").is_err());
    }

    #[test]
    fn host_commands_enter_pid_1_and_drop_to_the_chosen_user() {
        let args = ["-V".to_string()];
        let (prog, argv) = Runner::host("root").wrap(false, "tmux", &args);
        assert_eq!(prog, "nsenter");
        assert_eq!(argv.join(" "), "-t 1 -m -u -i -n -p tmux -V");
        let (_, argv) = Runner::host("termanch").wrap(false, "tmux", &args);
        assert_eq!(
            argv.join(" "),
            "-t 1 -m -u -i -n -p runuser -u termanch -- tmux -V"
        );
        let (prog, argv) = Runner::default().wrap(true, "tmux", &args);
        assert_eq!((prog.as_str(), argv), ("tmux", args.to_vec()));
    }

    #[test]
    fn a_server_start_leaves_the_container_cgroup_before_dropping_privileges() {
        let args = ["new-session".to_string()];
        let (_, argv) = Runner::host("termanch").wrap(true, "tmux", &args);
        let line = argv.join(" ");
        let scope = line.find("systemd-run --scope").expect("scope");
        let user = line.find("runuser -u termanch").expect("user");
        assert!(
            scope < user,
            "systemd-run runs as root, then runuser: {line}"
        );
        assert!(
            line.ends_with("sh runuser -u termanch -- tmux new-session"),
            "{line}"
        );
    }

    #[tokio::test]
    async fn the_host_self_check_rejects_the_wrong_user_and_a_missing_prefix() {
        // No prefix: commands run as this (non-root) test user, so asking for root must fail.
        let me = Runner::default();
        if std::process::Command::new("id")
            .arg("-u")
            .output()
            .map(|o| o.stdout)
            .map(|b| b == b"0\n")
            .unwrap_or(false)
        {
            return;
        }
        let err = me.check_host(true).await.unwrap_err().to_string();
        assert!(err.contains("not as the root user"), "{err}");
        // A prefix that cannot start gives the actionable hint.
        let broken = Runner {
            enter: vec!["/nonexistent-nsenter".into()],
            user: vec![],
        };
        let err = broken.check_host(false).await.unwrap_err().to_string();
        assert!(err.contains("--pid=host --privileged"), "{err}");
    }

    #[test]
    fn command_backend_needs_all_three_commands() {
        assert!(CommandBackend::new("x", "ls", "", "attach {id}").is_err());
        assert!(CommandBackend::new("x", "ls", "new {name}", "attach {id}").is_ok());
    }

    /// A backend with no multiplexer binary at all, only coreutils: proves the seam works for other tools.
    #[tokio::test]
    async fn command_backend_drives_arbitrary_tools() {
        let b = CommandBackend::new("echoer", r"printf one|First\ntwo\n", "true {name}", "cat")
            .unwrap();
        // printf itself expands the backslash escapes, so the argument stays one word.
        let list = b.list().await.unwrap();
        assert_eq!(
            list.iter().map(|s| s.id.as_str()).collect::<Vec<_>>(),
            ["one", "two"]
        );
        b.create("new-one").await.unwrap();
        assert!(b.create("bad name").await.is_err());
        let mut att = b.attach("one", 80, 24).unwrap();
        att.write(b"hello\n").unwrap();
        let chunk = tokio::time::timeout(std::time::Duration::from_secs(3), att.rx.recv())
            .await
            .unwrap()
            .unwrap();
        assert!(String::from_utf8_lossy(&chunk).contains("hello"));
    }
}
