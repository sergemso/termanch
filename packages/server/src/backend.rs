//! Where sessions live. The server only needs four things from a session manager: list them, create one,
//! name the command that attaches a terminal to one, and survive a client detaching. tmux is built in;
//! anything with a CLI that fits that shape (herdr, zellij, screen, ...) plugs in through `CommandBackend`;
//! a server-native backend can implement `SessionBackend` directly (plan step 7.1).
use std::sync::Arc;

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use termanch_core::protocol::SessionInfo;
use tokio::process::Command;

use crate::control::WindowState;
use crate::events::EventEnv;
use crate::pty::Attachment;

#[async_trait]
pub trait SessionBackend: Send + Sync {
    fn name(&self) -> &str;
    async fn list(&self) -> Result<Vec<SessionInfo>>;
    async fn create(&self, name: &str) -> Result<()>;
    /// Starts a terminal attached to session `id`. Dropping it must only detach.
    fn attach(&self, id: &str, cols: u16, rows: u16) -> Result<Attachment>;
    /// The session managers behind this backend, in the order "New session" offers them.
    fn kinds(&self) -> Vec<String> {
        vec![self.name().to_string()]
    }
    /// Creates in a named manager; a backend with a single manager ignores the name.
    async fn create_in(&self, name: &str, _backend: Option<&str>) -> Result<()> {
        self.create(name).await
    }
    /// Creates a session in a working directory, optionally starting a coding agent in it. Managers that cannot
    /// do either ignore them.
    async fn create_with(
        &self,
        name: &str,
        backend: Option<&str>,
        _dir: Option<&str>,
        _template: Option<&str>,
    ) -> Result<()> {
        self.create_in(name, backend).await
    }
    /// The visible text of the session's pane, for checking what a one-tap answer would answer.
    async fn capture(&self, _id: &str) -> Result<String> {
        Err(anyhow!("this session manager cannot read a pane"))
    }
    /// Like `capture`, with the colour and style escape codes kept (for a snapshot the client draws).
    async fn capture_styled(&self, id: &str) -> Result<String> {
        self.capture(id).await
    }
    /// `capture_styled` of one window instead of the current one.
    async fn capture_window_styled(&self, id: &str, _index: u32) -> Result<String> {
        self.capture_styled(id).await
    }
    /// Types `text` into the session's pane as if it was typed there.
    async fn send_text(&self, _id: &str, _text: &str) -> Result<()> {
        Err(anyhow!("this session manager cannot send keys"))
    }
    /// Ends the session and everything running in it. The caller has already asked the user.
    async fn kill(&self, _id: &str) -> Result<()> {
        Err(anyhow!("this session manager cannot close sessions"))
    }
    /// The windows of a session, for the windows dropdown.
    async fn windows(&self, _id: &str) -> Result<Vec<WindowState>> {
        Err(anyhow!("this session manager has no windows"))
    }
    /// Makes window `index` the one the next client sees, whoever is attached (the user chose it).
    async fn select_window(&self, _id: &str, _index: u32) -> Result<()> {
        Err(anyhow!("this session manager has no windows"))
    }
    /// Like `select_window`, but only when no real terminal is attached to the session, so opening a tab never
    /// moves a screen somebody else is looking at. Returns whether it switched.
    async fn focus_window(&self, _id: &str, _index: u32) -> Result<bool> {
        Ok(false)
    }
    /// Closes one window; closing the last one ends the session.
    async fn kill_window(&self, _id: &str, _index: u32) -> Result<()> {
        Err(anyhow!("this session manager has no windows"))
    }
    /// Opens a window next to the others, in the directory of the session's current window, and makes it the
    /// current one.
    async fn new_window(&self, _id: &str) -> Result<()> {
        Err(anyhow!("this session manager has no windows"))
    }
}

/// Session ids/names we accept from clients; they end up in argv, never in a shell.
pub fn valid_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 64
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

/// A working directory a client may ask for: absolute, no control characters, a sane length. It reaches tmux as
/// one argument, never through a shell.
pub fn valid_dir(dir: &str) -> bool {
    dir.starts_with('/') && dir.len() <= 512 && !dir.chars().any(|c| c.is_control())
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
                backend: None,
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
    /// `env K=V -u K ...` words put in front of every command; empty normally, used by tests to give a
    /// tool a private home or socket directory without touching this process's environment.
    env: Vec<String>,
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
    /// Sets (`Some`) or removes (`None`) environment variables for every command this runner starts.
    #[cfg(test)]
    pub fn with_env(mut self, vars: &[(&str, Option<&str>)]) -> Self {
        for (k, v) in vars {
            match v {
                Some(v) => self.env.push(format!("{k}={v}")),
                // `env` reads its options before the first NAME=value.
                None => {
                    self.env.insert(0, k.to_string());
                    self.env.insert(0, "-u".to_string());
                }
            }
        }
        self
    }

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
        Self {
            enter,
            user,
            env: vec![],
        }
    }

    /// The program and arguments to actually execute for `program args`. `detach` is for commands that
    /// start a long-lived server (tmux new-session).
    pub fn wrap(&self, detach: bool, program: &str, args: &[String]) -> (String, Vec<String>) {
        let mut argv: Vec<String> = self.enter.clone();
        if detach && !self.enter.is_empty() {
            argv.extend(DETACH.iter().map(|s| s.to_string()));
        }
        argv.extend(self.user.iter().cloned());
        if !self.env.is_empty() {
            argv.push("env".to_string());
            argv.extend(self.env.iter().cloned());
        }
        argv.push(program.to_string());
        argv.extend(args.iter().cloned());
        let first = argv.remove(0);
        (first, argv)
    }

    pub async fn run(&self, program: &str, args: &[String]) -> Result<std::process::Output> {
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

    /// A long-lived child with piped stdin/stdout (a control-mode client); it dies with its handle.
    pub fn spawn_piped(&self, program: &str, args: &[String]) -> Result<tokio::process::Child> {
        let (program, args) = self.wrap(false, program, args);
        Command::new(&program)
            .args(&args)
            .envs(crate::locale::utf8_env())
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| anyhow!("cannot run {program}: {e}"))
    }

    /// Starts a long-lived process (a session server) that must outlive this call and the connection.
    fn spawn_detached(&self, program: &str, args: &[String]) -> Result<()> {
        let (program, args) = self.wrap(true, program, args);
        let mut child = Command::new(&program)
            .args(&args)
            .envs(crate::locale::utf8_env())
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .process_group(0)
            .spawn()
            .map_err(|e| anyhow!("cannot run {program}: {e}"))?;
        // Reap it if it ever exits; a session server normally runs until its session is closed.
        tokio::spawn(async move {
            let _ = child.wait().await;
        });
        Ok(())
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
    events: Option<EventEnv>,
    /// Added to the session name wherever events refer to it (`tmux:` when several managers run).
    event_prefix: String,
}

impl TmuxBackend {
    pub fn new(runner: Runner) -> Self {
        Self {
            runner,
            events: None,
            event_prefix: String::new(),
        }
    }

    pub fn with_event_prefix(mut self, prefix: &str) -> Self {
        self.event_prefix = prefix.to_string();
        self
    }

    /// New sessions get the variables agent tools use to report events (plan v6).
    pub fn with_events(mut self, events: EventEnv) -> Self {
        self.events = Some(events);
        self
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
        self.create_with(name, None, None, None).await
    }

    async fn create_with(
        &self,
        name: &str,
        _backend: Option<&str>,
        dir: Option<&str>,
        template: Option<&str>,
    ) -> Result<()> {
        if !valid_name(name) {
            return Err(anyhow!(
                "Session names use letters, digits, - and _ (max 64)"
            ));
        }
        // Only the agents the scan knows may be started from a client; a plain shell otherwise.
        let template = match template.filter(|t| !t.is_empty() && *t != "shell") {
            Some(t) => Some(
                crate::adapters::AGENTS
                    .into_iter()
                    .find(|a| *a == t)
                    .ok_or_else(|| anyhow!("Unknown agent template"))?,
            ),
            None => None,
        };
        let mut args: Vec<String> = ["new-session", "-d", "-s", name].map(String::from).into();
        if let Some(dir) = dir.filter(|d| !d.is_empty()) {
            if !valid_dir(dir) {
                return Err(anyhow!("The directory must be an absolute path"));
            }
            args.extend(["-c".to_string(), dir.to_string()]);
        }
        for var in self
            .events
            .iter()
            .flat_map(|e| e.vars(&format!("{}{name}", self.event_prefix)))
        {
            args.extend(["-e".to_string(), var]);
        }
        let out = self.runner.run_as(true, "tmux", &args).await?;
        if !out.status.success() {
            return Err(anyhow!(
                "tmux new-session failed: {}",
                String::from_utf8_lossy(&out.stderr).trim()
            ));
        }
        if let Some(agent) = template {
            // Typed into the new shell, so quitting the agent leaves the shell (and the session) alive.
            self.send_text(name, &format!("{agent}\r")).await?;
        }
        Ok(())
    }

    async fn capture(&self, id: &str) -> Result<String> {
        if !valid_name(id) {
            return Err(anyhow!("Unknown session"));
        }
        let args = ["capture-pane", "-p", "-t", &format!("={id}:")].map(String::from);
        let out = self.runner.run("tmux", &args).await?;
        if !out.status.success() {
            return Err(anyhow!("the pane cannot be read"));
        }
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    }

    async fn capture_styled(&self, id: &str) -> Result<String> {
        if !valid_name(id) {
            return Err(anyhow!("Unknown session"));
        }
        let args = ["capture-pane", "-e", "-p", "-t", &format!("={id}:")].map(String::from);
        let out = self.runner.run("tmux", &args).await?;
        if !out.status.success() {
            return Err(anyhow!("the pane cannot be read"));
        }
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    }

    async fn capture_window_styled(&self, id: &str, index: u32) -> Result<String> {
        if !valid_name(id) {
            return Err(anyhow!("Unknown session"));
        }
        let args = ["capture-pane", "-e", "-p", "-t", &format!("={id}:{index}")].map(String::from);
        let out = self.runner.run("tmux", &args).await?;
        if !out.status.success() {
            return Err(anyhow!("the pane cannot be read"));
        }
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    }

    async fn send_text(&self, id: &str, text: &str) -> Result<()> {
        if !valid_name(id) {
            return Err(anyhow!("Unknown session"));
        }
        // `\r` is Enter; everything else is literal (`-l`), so no tmux key name can be smuggled in.
        for (i, part) in text.split('\r').enumerate() {
            if i > 0 {
                let args = ["send-keys", "-t", &format!("={id}:"), "Enter"].map(String::from);
                self.runner.run("tmux", &args).await?;
            }
            if !part.is_empty() {
                let args =
                    ["send-keys", "-t", &format!("={id}:"), "-l", "--", part].map(String::from);
                self.runner.run("tmux", &args).await?;
            }
        }
        Ok(())
    }

    async fn kill(&self, id: &str) -> Result<()> {
        if !valid_name(id) {
            return Err(anyhow!("Unknown session"));
        }
        let args = ["kill-session", "-t", &format!("={id}")].map(String::from);
        let out = self.runner.run("tmux", &args).await?;
        if !out.status.success() {
            return Err(anyhow!(
                "tmux kill-session failed: {}",
                String::from_utf8_lossy(&out.stderr).trim()
            ));
        }
        Ok(())
    }

    async fn windows(&self, id: &str) -> Result<Vec<WindowState>> {
        crate::control::read_windows(&self.runner, id).await
    }

    async fn select_window(&self, id: &str, index: u32) -> Result<()> {
        if !valid_name(id) {
            return Err(anyhow!("Unknown session"));
        }
        let args = ["select-window", "-t", &format!("={id}:{index}")].map(String::from);
        let out = self.runner.run("tmux", &args).await?;
        if !out.status.success() {
            return Err(anyhow!("that window is gone"));
        }
        Ok(())
    }

    async fn focus_window(&self, id: &str, index: u32) -> Result<bool> {
        if !valid_name(id) {
            return Err(anyhow!("Unknown session"));
        }
        let args = [
            "list-clients",
            "-t",
            &format!("={id}"),
            "-F",
            "#{client_control_mode}",
        ]
        .map(String::from);
        let out = self.runner.run("tmux", &args).await?;
        let real_client = String::from_utf8_lossy(&out.stdout)
            .lines()
            .any(|l| l.trim() == "0");
        if !out.status.success() || real_client {
            return Ok(false);
        }
        self.select_window(id, index).await?;
        Ok(true)
    }

    async fn new_window(&self, id: &str) -> Result<()> {
        if !valid_name(id) {
            return Err(anyhow!("Unknown session"));
        }
        // tmux does not expand a format in -c, so ask for the current window's directory first. It is passed
        // as one argument, never through a shell, and only when it is a sane absolute path.
        let ask = [
            "display-message",
            "-p",
            "-t",
            &format!("={id}:"),
            "#{pane_current_path}",
        ]
        .map(String::from);
        let asked = self.runner.run("tmux", &ask).await?;
        let dir = String::from_utf8_lossy(&asked.stdout).trim().to_string();
        let mut args = vec!["new-window".to_string(), "-t".into(), format!("={id}:")];
        if asked.status.success() && valid_dir(&dir) {
            args.extend(["-c".to_string(), dir]);
        }
        let out = self.runner.run("tmux", &args).await?;
        if !out.status.success() {
            return Err(anyhow!("could not open a window"));
        }
        Ok(())
    }

    async fn kill_window(&self, id: &str, index: u32) -> Result<()> {
        if !valid_name(id) {
            return Err(anyhow!("Unknown session"));
        }
        let args = ["kill-window", "-t", &format!("={id}:{index}")].map(String::from);
        let out = self.runner.run("tmux", &args).await?;
        if !out.status.success() {
            return Err(anyhow!("that window is gone"));
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

/// `herdr session list --json`: the running sessions, by name.
pub fn parse_herdr_list(json: &str) -> Result<Vec<SessionInfo>> {
    let v: serde_json::Value = serde_json::from_str(json)?;
    Ok(v["sessions"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|s| s["running"].as_bool() == Some(true))
        .filter_map(|s| s["name"].as_str())
        .filter(|n| valid_name(n))
        .map(|n| SessionInfo {
            id: n.to_string(),
            name: n.to_string(),
            agent: None,
            backend: None,
        })
        .collect())
}

/// herdr (https://herdr.dev): named persistent sessions, each with its own headless server. Verified on 0.9.3:
/// a session is created by starting `herdr --session NAME server`, `herdr session attach NAME` repaints the
/// whole screen and killing that client leaves the session running.
pub struct HerdrBackend {
    runner: Runner,
    events: Option<EventEnv>,
    event_prefix: String,
}

impl HerdrBackend {
    pub fn new(runner: Runner) -> Self {
        Self {
            runner,
            events: None,
            event_prefix: String::new(),
        }
    }

    pub fn with_event_prefix(mut self, prefix: &str) -> Self {
        self.event_prefix = prefix.to_string();
        self
    }

    pub fn with_events(mut self, events: EventEnv) -> Self {
        self.events = Some(events);
        self
    }
}

#[async_trait]
impl SessionBackend for HerdrBackend {
    fn name(&self) -> &str {
        "herdr"
    }

    async fn list(&self) -> Result<Vec<SessionInfo>> {
        let args = ["session", "list", "--json"].map(String::from);
        let out = self.runner.run("herdr", &args).await?;
        if !out.status.success() {
            return Err(anyhow!(
                "herdr session list failed: {}",
                String::from_utf8_lossy(&out.stderr).trim()
            ));
        }
        parse_herdr_list(&String::from_utf8_lossy(&out.stdout))
    }

    async fn create(&self, name: &str) -> Result<()> {
        if !valid_name(name) {
            return Err(anyhow!(
                "Session names use letters, digits, - and _ (max 64)"
            ));
        }
        if self.list().await?.iter().any(|s| s.id == name) {
            return Err(anyhow!("Session {name} already exists"));
        }
        // The panes inherit the server's environment, so the event variables go through `env`.
        let mut args: Vec<String> = self
            .events
            .iter()
            .flat_map(|e| e.vars(&format!("{}{name}", self.event_prefix)))
            .collect();
        args.extend(["herdr", "--session", name, "server"].map(String::from));
        self.runner.spawn_detached("env", &args)?;
        // The server needs a moment to open its socket; attaching before that would start a second one.
        for _ in 0..30 {
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            if self.list().await?.iter().any(|s| s.id == name) {
                return Ok(());
            }
        }
        Err(anyhow!("herdr did not start session {name}"))
    }

    fn attach(&self, id: &str, cols: u16, rows: u16) -> Result<Attachment> {
        if !valid_name(id) {
            return Err(anyhow!("Unknown session"));
        }
        let args = ["session", "attach", id].map(String::from);
        self.runner.attach("herdr", &args, cols, rows)
    }
}

/// Several session managers at once. Session ids become `manager:name` so a tmux `work` and a herdr `work`
/// stay apart; the client shows the manager next to the name.
pub struct CompositeBackend {
    parts: Vec<(String, Arc<dyn SessionBackend>)>,
}

impl CompositeBackend {
    pub fn new(parts: Vec<(String, Arc<dyn SessionBackend>)>) -> Self {
        Self { parts }
    }

    fn part(&self, kind: &str) -> Result<&Arc<dyn SessionBackend>> {
        self.parts
            .iter()
            .find(|(k, _)| k == kind)
            .map(|(_, b)| b)
            .ok_or_else(|| anyhow!("Unknown session manager"))
    }
}

#[async_trait]
impl SessionBackend for CompositeBackend {
    fn name(&self) -> &str {
        "mixed"
    }

    /// A manager that fails to answer (herdr not installed, say) only hides its own sessions.
    async fn list(&self) -> Result<Vec<SessionInfo>> {
        let mut all = Vec::new();
        for (kind, b) in &self.parts {
            match b.list().await {
                Ok(list) => all.extend(list.into_iter().map(|s| SessionInfo {
                    id: format!("{kind}:{}", s.id),
                    backend: Some(kind.clone()),
                    ..s
                })),
                Err(e) => tracing::warn!("{kind}: cannot list sessions: {e}"),
            }
        }
        Ok(all)
    }

    async fn create(&self, name: &str) -> Result<()> {
        self.create_in(name, None).await
    }

    async fn create_in(&self, name: &str, backend: Option<&str>) -> Result<()> {
        self.create_with(name, backend, None, None).await
    }

    async fn create_with(
        &self,
        name: &str,
        backend: Option<&str>,
        dir: Option<&str>,
        template: Option<&str>,
    ) -> Result<()> {
        let b = match backend {
            Some(k) => self.part(k)?,
            None => &self.parts[0].1,
        };
        b.create_with(name, backend, dir, template).await
    }

    fn attach(&self, id: &str, cols: u16, rows: u16) -> Result<Attachment> {
        let (kind, name) = id
            .split_once(':')
            .ok_or_else(|| anyhow!("Unknown session"))?;
        self.part(kind)?.attach(name, cols, rows)
    }

    fn kinds(&self) -> Vec<String> {
        self.parts.iter().map(|(k, _)| k.clone()).collect()
    }

    async fn capture(&self, id: &str) -> Result<String> {
        let (kind, name) = id
            .split_once(':')
            .ok_or_else(|| anyhow!("Unknown session"))?;
        self.part(kind)?.capture(name).await
    }

    async fn capture_styled(&self, id: &str) -> Result<String> {
        let (kind, name) = id
            .split_once(':')
            .ok_or_else(|| anyhow!("Unknown session"))?;
        self.part(kind)?.capture_styled(name).await
    }

    async fn capture_window_styled(&self, id: &str, index: u32) -> Result<String> {
        let (kind, name) = id
            .split_once(':')
            .ok_or_else(|| anyhow!("Unknown session"))?;
        self.part(kind)?.capture_window_styled(name, index).await
    }

    async fn send_text(&self, id: &str, text: &str) -> Result<()> {
        let (kind, name) = id
            .split_once(':')
            .ok_or_else(|| anyhow!("Unknown session"))?;
        self.part(kind)?.send_text(name, text).await
    }

    async fn kill(&self, id: &str) -> Result<()> {
        let (kind, name) = id
            .split_once(':')
            .ok_or_else(|| anyhow!("Unknown session"))?;
        self.part(kind)?.kill(name).await
    }

    async fn windows(&self, id: &str) -> Result<Vec<WindowState>> {
        let (kind, name) = id
            .split_once(':')
            .ok_or_else(|| anyhow!("Unknown session"))?;
        self.part(kind)?.windows(name).await
    }

    async fn select_window(&self, id: &str, index: u32) -> Result<()> {
        let (kind, name) = id
            .split_once(':')
            .ok_or_else(|| anyhow!("Unknown session"))?;
        self.part(kind)?.select_window(name, index).await
    }

    async fn focus_window(&self, id: &str, index: u32) -> Result<bool> {
        let (kind, name) = id
            .split_once(':')
            .ok_or_else(|| anyhow!("Unknown session"))?;
        self.part(kind)?.focus_window(name, index).await
    }

    async fn kill_window(&self, id: &str, index: u32) -> Result<()> {
        let (kind, name) = id
            .split_once(':')
            .ok_or_else(|| anyhow!("Unknown session"))?;
        self.part(kind)?.kill_window(name, index).await
    }

    async fn new_window(&self, id: &str) -> Result<()> {
        let (kind, name) = id
            .split_once(':')
            .ok_or_else(|| anyhow!("Unknown session"))?;
        self.part(kind)?.new_window(name).await
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
    fn herdr_list_keeps_running_sessions_with_safe_names() {
        let json = r#"{"sessions":[{"name":"default","running":false},{"name":"work","running":true},{"name":"a b","running":true}]}"#;
        let ids: Vec<_> = parse_herdr_list(json)
            .unwrap()
            .into_iter()
            .map(|s| s.id)
            .collect();
        assert_eq!(ids, ["work"]);
        assert!(parse_herdr_list("nope").is_err());
        assert!(parse_herdr_list("{}").unwrap().is_empty());
    }

    /// Two fake managers sharing a session name stay apart.
    #[tokio::test]
    async fn the_composite_keeps_same_named_sessions_of_different_managers_apart() {
        let a: Arc<dyn SessionBackend> = Arc::new(
            CommandBackend::new("a", r"printf work|Work\n", "true {name}", "cat").unwrap(),
        );
        let b: Arc<dyn SessionBackend> = Arc::new(
            CommandBackend::new("b", r"printf work|Work\nother\n", "true {name}", "cat").unwrap(),
        );
        let c = CompositeBackend::new(vec![("one".into(), a), ("two".into(), b)]);
        let list = c.list().await.unwrap();
        let ids: Vec<_> = list
            .iter()
            .map(|s| (s.id.as_str(), s.backend.as_deref().unwrap()))
            .collect();
        assert_eq!(
            ids,
            [
                ("one:work", "one"),
                ("two:work", "two"),
                ("two:other", "two")
            ]
        );
        assert_eq!(c.kinds(), ["one", "two"]);
        c.create_in("fresh", Some("two")).await.unwrap();
        assert!(c.create_in("fresh", Some("nope")).await.is_err());
        assert!(
            c.attach("work", 80, 24).is_err(),
            "an id without a manager is refused"
        );
        assert!(c.attach("zzz:work", 80, 24).is_err());
        assert!(c.attach("two:work", 80, 24).is_ok());
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
            env: vec![],
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

    /// Needs a real herdr; skipped when the binary is absent. Runs in a throwaway config dir so no real session is touched.
    #[tokio::test]
    async fn herdr_backend_creates_lists_and_reattaches() {
        if std::process::Command::new("herdr")
            .arg("--version")
            .output()
            .is_err()
        {
            return;
        }
        let dir = std::env::temp_dir().join(format!("termanch-herdr-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let d = dir.to_str().unwrap();
        let b = HerdrBackend::new(Runner::default().with_env(&[
            ("HERDR_ENV", None),
            ("HERDR_SOCKET_PATH", None),
            ("HERDR_PANE_ID", None),
            ("XDG_CONFIG_HOME", Some(d)),
            ("HOME", Some(d)),
        ]));
        b.create("t-one").await.unwrap();
        assert!(b.create("t-one").await.is_err());
        assert!(b.list().await.unwrap().iter().any(|s| s.id == "t-one"));
        for _ in 0..2 {
            let mut att = b.attach("t-one", 100, 30).unwrap();
            let chunk = tokio::time::timeout(std::time::Duration::from_secs(5), att.rx.recv())
                .await
                .unwrap()
                .unwrap();
            assert!(chunk.len() > 50, "the attach repaints the screen");
        }
        // Dropping an attachment only detached: the session is still there.
        assert!(b.list().await.unwrap().iter().any(|s| s.id == "t-one"));
        let _ = std::process::Command::new("env")
            .args([
                "-u",
                "HERDR_ENV",
                &format!("XDG_CONFIG_HOME={d}"),
                &format!("HOME={d}"),
                "herdr",
                "--session",
                "t-one",
                "server",
                "stop",
            ])
            .output();
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Real tmux next to real herdr (private home), same session name in both.
    #[tokio::test]
    async fn tmux_and_herdr_sessions_with_one_name_live_side_by_side() {
        let have = |bin: &str| {
            std::process::Command::new(bin).arg("-V").output().is_ok()
                || std::process::Command::new(bin)
                    .arg("--version")
                    .output()
                    .is_ok()
        };
        if !have("tmux") || !have("herdr") {
            return;
        }
        let name = format!("mix{}", &uuid::Uuid::new_v4().simple().to_string()[..6]);
        let dir = std::env::temp_dir().join(format!("termanch-mix-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let d = dir.to_str().unwrap();
        let herdr_env = [
            ("HERDR_ENV", None),
            ("HERDR_SOCKET_PATH", None),
            ("HERDR_PANE_ID", None),
            ("XDG_CONFIG_HOME", Some(d)),
            ("HOME", Some(d)),
        ];
        let c = CompositeBackend::new(vec![
            ("tmux".into(), Arc::new(TmuxBackend::new(Runner::default()))),
            (
                "herdr".into(),
                Arc::new(HerdrBackend::new(Runner::default().with_env(&herdr_env))),
            ),
        ]);
        c.create_in(&name, Some("tmux")).await.unwrap();
        c.create_in(&name, Some("herdr")).await.unwrap();
        let ids: Vec<String> = c.list().await.unwrap().into_iter().map(|s| s.id).collect();
        assert!(
            ids.contains(&format!("tmux:{name}")) && ids.contains(&format!("herdr:{name}")),
            "{ids:?}"
        );
        for kind in ["tmux", "herdr"] {
            let mut att = c.attach(&format!("{kind}:{name}"), 100, 30).unwrap();
            let chunk = tokio::time::timeout(std::time::Duration::from_secs(5), att.rx.recv())
                .await
                .unwrap()
                .unwrap();
            assert!(!chunk.is_empty(), "{kind} painted nothing");
        }
        let _ = std::process::Command::new("tmux")
            .args(["kill-session", "-t", &format!("={name}")])
            .output();
        let _ = std::process::Command::new("env")
            .args([
                "-u",
                "HERDR_ENV",
                &format!("XDG_CONFIG_HOME={d}"),
                &format!("HOME={d}"),
                "herdr",
                "--session",
                &name,
                "server",
                "stop",
            ])
            .output();
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Real tmux: text sent to a pane is typed there (with Enter for `\r`), and capture reads it back.
    #[tokio::test]
    async fn tmux_send_text_types_into_the_pane_and_capture_reads_it() {
        if std::process::Command::new("tmux")
            .arg("-V")
            .output()
            .is_err()
        {
            return;
        }
        let b = TmuxBackend::default();
        let name = format!("snd{}", &uuid::Uuid::new_v4().simple().to_string()[..6]);
        b.create(&name).await.unwrap();
        b.send_text(&name, "echo typed$((40+2))\r").await.unwrap();
        let mut seen = String::new();
        for _ in 0..20 {
            tokio::time::sleep(std::time::Duration::from_millis(150)).await;
            seen = b.capture(&name).await.unwrap();
            if seen.contains("typed42") {
                break;
            }
        }
        assert!(seen.contains("typed42"), "{seen}");
        assert!(b.send_text("bad name", "x").await.is_err());
        let _ = std::process::Command::new("tmux")
            .args(["kill-session", "-t", &format!("={name}")])
            .output();
    }

    /// Real tmux: the styled capture keeps the colour codes the plain one drops.
    #[tokio::test]
    async fn tmux_styled_capture_keeps_colour_codes() {
        if std::process::Command::new("tmux")
            .arg("-V")
            .output()
            .is_err()
        {
            return;
        }
        let b = TmuxBackend::default();
        let name = format!("sty{}", &uuid::Uuid::new_v4().simple().to_string()[..6]);
        b.create(&name).await.unwrap();
        b.send_text(&name, "printf '\\033[31mredword\\033[0m\\n'\r")
            .await
            .unwrap();
        let mut styled = String::new();
        for _ in 0..40 {
            tokio::time::sleep(std::time::Duration::from_millis(150)).await;
            styled = b.capture_styled(&name).await.unwrap();
            // The typed command line echoes the word too; the output is the part that carries the escape code.
            if styled.contains("\x1b[31m") {
                break;
            }
        }
        let plain = b.capture(&name).await.unwrap();
        let _ = std::process::Command::new("tmux")
            .args(["kill-session", "-t", &format!("={name}")])
            .output();
        assert!(
            styled.contains("\x1b[31m") && styled.contains("redword"),
            "{styled:?}"
        );
        assert!(
            !plain.contains("\x1b["),
            "the plain capture has no escape codes"
        );
    }

    #[test]
    fn only_absolute_clean_directories_are_accepted() {
        assert!(valid_dir("/home/u/app"));
        assert!(!valid_dir("app"));
        assert!(!valid_dir("/tmp/a\nb"));
        assert!(!valid_dir(&format!("/{}", "a".repeat(600))));
    }

    #[tokio::test]
    async fn a_new_session_starts_in_the_asked_directory_and_unknown_agents_are_refused() {
        if std::process::Command::new("tmux")
            .arg("-V")
            .output()
            .is_err()
        {
            return;
        }
        let dir = std::env::temp_dir().join(format!("tm-new-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let tmpdir = dir.to_string_lossy().into_owned();
        let runner = Runner::default().with_env(&[
            ("TMUX_TMPDIR", Some(tmpdir.as_str())),
            ("TMUX", None),
            ("HERDR_ENV", None),
        ]);
        let b = TmuxBackend::new(runner.clone());
        assert!(b
            .create_with("nd", None, Some("relative"), None)
            .await
            .is_err());
        assert!(b
            .create_with("nd", None, None, Some("rm -rf"))
            .await
            .is_err());
        b.create_with("nd", None, Some("/tmp"), None).await.unwrap();
        let mut path = String::new();
        for _ in 0..20 {
            path = b.windows("nd").await.unwrap()[0].info.path.clone();
            if path == "/tmp" {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        }
        assert_eq!(path, "/tmp");
        b.kill("nd").await.unwrap();
        assert!(b.list().await.map(|l| l.is_empty()).unwrap_or(true));
        let _ = runner.run("tmux", &["kill-server".to_string()]).await;
        let _ = std::fs::remove_dir_all(&dir);
    }
}
