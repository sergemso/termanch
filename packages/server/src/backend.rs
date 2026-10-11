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

async fn run(program: &str, args: &[String]) -> Result<std::process::Output> {
    Command::new(program)
        .args(args)
        .output()
        .await
        .map_err(|e| anyhow!("cannot run {program}: {e}"))
}

pub struct TmuxBackend;

#[async_trait]
impl SessionBackend for TmuxBackend {
    fn name(&self) -> &str {
        "tmux"
    }

    async fn list(&self) -> Result<Vec<SessionInfo>> {
        let args = ["list-sessions", "-F", "#{session_name}|#{session_name}"].map(String::from);
        let out = run("tmux", &args).await?;
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
        let out = run("tmux", &args).await?;
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
        Attachment::spawn("tmux", &args, cols, rows)
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
}

impl CommandBackend {
    pub fn new(label: &str, list: &str, create: &str, attach: &str) -> Result<Self> {
        let split = |s: &str| s.split_whitespace().map(String::from).collect::<Vec<_>>();
        let backend = Self {
            label: label.to_string(),
            list: split(list),
            create: split(create),
            attach: split(attach),
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
        let out = run(&self.list[0], &self.list[1..]).await?;
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
        let out = run(&argv[0], &argv[1..]).await?;
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
        Attachment::spawn(&argv[0], &argv[1..], cols, rows)
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
