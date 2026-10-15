//! Unified agent hooks: auto-install per-agent hooks for zero-effort observability.
//! Each agent has a different config mechanism; we abstract them behind a trait.
use std::path::{Path, PathBuf};

use anyhow::Result;

pub mod claude;
pub mod codex;
pub mod copilot;
pub mod kilo;
pub mod opencode;

use crate::backend::Runner;

/// Which agent to hook. Matches the scan's agent_name() output.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum AgentKind {
    Claude,
    Codex,
    Copilot,
    Kilo,
    Opencode,
}

impl AgentKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Claude => "claude",
            Self::Codex => "codex",
            Self::Copilot => "copilot",
            Self::Kilo => "kilo",
            Self::Opencode => "opencode",
        }
    }

    pub fn default_settings_path(&self, home: &Path) -> PathBuf {
        get_hooks(*self).default_settings_path(home)
    }
}

/// Hook configuration for an agent kind.
pub struct HookConfig {
    pub kind: AgentKind,
    /// The binary path to call (e.g., termenbox-server).
    pub binary: String,
    /// The session's TMUX_SESSION name (without prefix).
    pub session_name: String,
    /// The termenbox event token for this session.
    pub token: String,
    /// Path to the agent's settings file (or directory).
    pub settings_path: PathBuf,
}

impl HookConfig {
    /// Build a hook config from a session. Uses the server binary path for the hook command.
    pub fn new(
        kind: AgentKind,
        binary: String,
        session_name: String,
        token: String,
        home: &Path,
        runner: Runner,
    ) -> Self {
        let settings_path = kind.default_settings_path(home);
        let _ = runner; // unused but kept for API compatibility
        Self {
            kind,
            binary,
            session_name,
            token,
            settings_path,
        }
    }

    /// The hook command the agent will run.
    fn hook_command(&self) -> String {
        format!(
            "{} --hook {} {} {}",
            self.binary,
            self.kind.as_str(),
            self.session_name,
            self.token
        )
    }
}

/// Trait for per-agent hook installation.
/// Each implementation knows the agent's config format, paths, and event mapping.
pub trait AgentHooks {
    /// The agent kind this implementation handles.
    fn kind(&self) -> AgentKind;

    /// Default settings file path (global/user-level).
    fn default_settings_path(&self, home: &Path) -> PathBuf;

    /// Preview the changes that would be made (for dry-run).
    fn preview(&self, config: &HookConfig) -> String;

    /// Install hooks into the agent's config (merge with existing, idempotent).
    fn connect(&self, config: &HookConfig, apply: bool) -> Result<String>;

    /// Remove only our hooks from the agent's config.
    fn disconnect(&self, config: &HookConfig) -> Result<String>;

    /// Check if hooks are currently installed.
    fn is_connected(&self, config: &HookConfig) -> bool;
}

/// Registry of all supported agent hooks.
pub fn get_hooks(kind: AgentKind) -> Box<dyn AgentHooks> {
    match kind {
        AgentKind::Claude => Box::new(claude::ClaudeHooks),
        AgentKind::Codex => Box::new(codex::CodexHooks),
        AgentKind::Copilot => Box::new(copilot::CopilotHooks),
        AgentKind::Kilo => Box::new(kilo::KiloHooks),
        AgentKind::Opencode => Box::new(opencode::OpencodeHooks),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    #[test]
    fn agent_kind_from_scan_name() {
        // This test will be updated when from_scan_name is needed
        assert_eq!(AgentKind::Claude.as_str(), "claude");
        assert_eq!(AgentKind::Codex.as_str(), "codex");
        assert_eq!(AgentKind::Copilot.as_str(), "copilot");
        assert_eq!(AgentKind::Kilo.as_str(), "kilo");
        assert_eq!(AgentKind::Opencode.as_str(), "opencode");
    }

    #[test]
    fn hook_config_builds_command() {
        let config = HookConfig::new(
            AgentKind::Claude,
            "/bin/termenbox-server".into(),
            "mysession".into(),
            "mytoken".into(),
            Path::new("/home/user"),
            Runner::default(),
        );
        assert_eq!(
            config.hook_command(),
            "/bin/termenbox-server --hook claude mysession mytoken"
        );
    }
}
