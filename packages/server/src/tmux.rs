use anyhow::{anyhow, Result};
use termanch_core::protocol::SessionInfo;
use tokio::process::Command;

/// tmux session names we accept from clients; keeps `-t` targets unambiguous.
pub fn valid_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 64
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

pub fn parse_list(output: &str) -> Vec<SessionInfo> {
    output
        .lines()
        .filter_map(|line| {
            let name = line.split('|').next()?.trim();
            (!name.is_empty()).then(|| SessionInfo {
                id: name.to_string(),
                name: name.to_string(),
                agent: None,
            })
        })
        .collect()
}

pub async fn list() -> Result<Vec<SessionInfo>> {
    let out = Command::new("tmux")
        .args(["list-sessions", "-F", "#{session_name}|#{session_attached}"])
        .output()
        .await?;
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

pub async fn new_session(name: &str) -> Result<()> {
    if !valid_name(name) {
        return Err(anyhow!(
            "Session names use letters, digits, - and _ (max 64)"
        ));
    }
    let out = Command::new("tmux")
        .args(["new-session", "-d", "-s", name])
        .output()
        .await?;
    if !out.status.success() {
        return Err(anyhow!(
            "tmux new-session failed: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_session_lines() {
        let infos = parse_list("main|1\nwork|0\n\n");
        assert_eq!(
            infos.iter().map(|i| i.id.as_str()).collect::<Vec<_>>(),
            ["main", "work"]
        );
    }

    #[test]
    fn rejects_unsafe_names() {
        assert!(valid_name("agent-1_a"));
        assert!(!valid_name(""));
        assert!(!valid_name("a b"));
        assert!(!valid_name("a:b"));
        assert!(!valid_name("=x"));
        assert!(!valid_name(&"a".repeat(65)));
    }
}
