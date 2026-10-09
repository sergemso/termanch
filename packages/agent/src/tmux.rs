use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use tokio::process::Command;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TmuxSession {
    pub id: String,
    pub name: String,
    pub agent: Option<String>,
    pub attached: bool,
}

pub struct TmuxManager {
    sessions: Arc<RwLock<HashMap<String, TmuxSession>>>,
}

impl TmuxManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn list_sessions(&self) -> Result<Vec<TmuxSession>> {
        let output = Command::new("tmux")
            .args(["list-sessions", "-F", "#{session_id}|#{session_name}|#{session_attached}"])
            .output()
            .await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if stderr.contains("no server running") {
                return Ok(vec![]);
            }
            return Err(anyhow::anyhow!("tmux list-sessions failed: {}", stderr));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut sessions = Vec::new();

        for line in stdout.lines() {
            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() >= 3 {
                sessions.push(TmuxSession {
                    id: parts[0].to_string(),
                    name: parts[1].to_string(),
                    agent: None,
                    attached: parts[2] == "1",
                });
            }
        }

        let mut map = self.sessions.write().await;
        *map = sessions.iter().map(|s| (s.id.clone(), s.clone())).collect();

        Ok(sessions)
    }

    pub async fn create_session(&self, name: &str) -> Result<TmuxSession> {
        let id = format!("termanch-{}", uuid::Uuid::new_v4().to_string()[..8].to_string());
        
        let output = Command::new("tmux")
            .args(["new-session", "-d", "-s", &id, "-n", name])
            .output()
            .await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("tmux new-session failed: {}", stderr));
        }

        let session = TmuxSession {
            id: id.clone(),
            name: name.to_string(),
            agent: None,
            attached: false,
        };

        self.sessions.write().await.insert(id.clone(), session.clone());
        Ok(session)
    }

    pub async fn attach_session(&self, session_id: &str) -> Result<()> {
        let output = Command::new("tmux")
            .args(["attach-session", "-t", session_id])
            .output()
            .await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("tmux attach-session failed: {}", stderr));
        }

        Ok(())
    }

    pub async fn send_keys(&self, session_id: &str, keys: &str) -> Result<()> {
        let output = Command::new("tmux")
            .args(["send-keys", "-t", session_id, keys])
            .output()
            .await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("tmux send-keys failed: {}", stderr));
        }

        Ok(())
    }

    pub async fn kill_session(&self, session_id: &str) -> Result<()> {
        let output = Command::new("tmux")
            .args(["kill-session", "-t", session_id])
            .output()
            .await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("tmux kill-session failed: {}", stderr));
        }

        self.sessions.write().await.remove(session_id);
        Ok(())
    }
}

impl Default for TmuxManager {
    fn default() -> Self {
        Self::new()
    }
}