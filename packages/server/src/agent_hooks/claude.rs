//! Claude Code hooks: edits ~/.claude/settings.json
use std::path::{Path, PathBuf};

use anyhow::{anyhow, Result};
use serde_json::{json, Value};

use super::{AgentHooks, AgentKind, HookConfig};

/// Events Claude Code supports (PascalCase in settings.json).
const EVENTS: [&str; 6] = [
    "SessionStart",
    "UserPromptSubmit",
    "PreToolUse",
    "PostToolUse",
    "Notification",
    "Stop",
];

/// Marker to identify our entries.
const MARKER: &str = "--hook claude";

pub struct ClaudeHooks;

impl AgentHooks for ClaudeHooks {
    fn kind(&self) -> AgentKind {
        AgentKind::Claude
    }

    fn default_settings_path(&self, home: &Path) -> PathBuf {
        home.join(".claude/settings.json")
    }

    fn preview(&self, config: &HookConfig) -> String {
        let entry = json!({"hooks": [{"type": "command", "command": config.hook_command(), "timeout": 2}]});
        let mut hooks = serde_json::Map::new();
        for e in EVENTS {
            hooks.insert(e.into(), json!([entry]));
        }
        serde_json::to_string_pretty(&json!({"hooks": hooks})).unwrap()
    }

    fn connect(&self, config: &HookConfig, apply: bool) -> Result<String> {
        let settings = &config.settings_path;
        let before = std::fs::read(settings).ok();
        let text = before
            .as_deref()
            .map(|b| String::from_utf8_lossy(b).into_owned())
            .unwrap_or_default();
        let merged = merge(&text, &config.hook_command())?;
        if !apply {
            return Ok(format!(
                "Would add hooks to {} (nothing else changes; a backup is kept):\n{}\nRun with --yes to apply.",
                settings.display(),
                self.preview(config)
            ));
        }
        std::fs::create_dir_all(settings.parent().unwrap_or(Path::new(".")))?;
        let tmp = settings.with_extension("json.termenbox-tmp");
        std::fs::write(&tmp, &merged)?;
        std::fs::rename(&tmp, settings)?;
        Ok(format!("Connected: hooks added to {}. Undo with --disconnect {}.", settings.display(), self.kind().as_str()))
    }

    fn disconnect(&self, config: &HookConfig) -> Result<String> {
        let settings = &config.settings_path;
        let current = std::fs::read_to_string(settings)
            .map_err(|e| anyhow!("cannot read {}: {e}", settings.display()))?;
        let cleaned = remove(&current)?;
        std::fs::write(settings, cleaned)?;
        Ok(format!("Disconnected: removed only Termenbox's hooks from {}; your other changes stay.", settings.display()))
    }

    fn is_connected(&self, config: &HookConfig) -> bool {
        let settings = &config.settings_path;
        std::fs::read_to_string(settings)
            .ok()
            .and_then(|s| serde_json::from_str::<Value>(&s).ok())
            .map(|v| {
                v.get("hooks")
                    .and_then(Value::as_object)
                    .map(|hooks| {
                        EVENTS.iter().any(|e| {
                            hooks.get(*e).and_then(Value::as_array).map(|arr| {
                                arr.iter().any(|entry| {
                                    entry["hooks"].as_array().map(|h| {
                                        h.iter().any(|c| {
                                            c["command"].as_str().map(|s| s.contains(MARKER)).unwrap_or(false)
                                        })
                                    }).unwrap_or(false)
                                })
                            }).unwrap_or(false)
                        })
                    })
                    .unwrap_or(false)
            })
            .unwrap_or(false)
    }
}

fn is_ours(entry: &Value) -> bool {
    entry["hooks"]
        .as_array()
        .map(|h| {
            h.iter().any(|c| {
                c["command"]
                    .as_str()
                    .map(|s| s.contains(MARKER))
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false)
}

fn merge(existing: &str, hook_command: &str) -> Result<String> {
    let mut root: Value = if existing.trim().is_empty() {
        json!({})
    } else {
        serde_json::from_str(existing)?
    };
    let obj = root
        .as_object_mut()
        .ok_or_else(|| anyhow!("the settings file is not a JSON object"))?;
    let hooks = obj.entry("hooks").or_insert_with(|| json!({}));
    let hooks = hooks
        .as_object_mut()
        .ok_or_else(|| anyhow!("`hooks` in the settings file is not an object"))?;
    let entry = json!({"hooks": [{"type": "command", "command": hook_command, "timeout": 2}]});
    for e in EVENTS {
        let list = hooks.entry(e).or_insert_with(|| json!([]));
        let list = list
            .as_array_mut()
            .ok_or_else(|| anyhow!("`hooks.{e}` is not a list"))?;
        if !list.iter().any(is_ours) {
            list.push(entry.clone());
        }
    }
    Ok(serde_json::to_string_pretty(&root)? + "\n")
}

fn remove(existing: &str) -> Result<String> {
    let mut root: Value = serde_json::from_str(existing)?;
    if let Some(hooks) = root.get_mut("hooks").and_then(Value::as_object_mut) {
        for e in EVENTS {
            if let Some(list) = hooks.get_mut(e).and_then(Value::as_array_mut) {
                list.retain(|x| !is_ours(x));
                if list.is_empty() {
                    hooks.remove(e);
                }
            }
        }
        if hooks.is_empty() {
            root.as_object_mut().unwrap().remove("hooks");
        }
    }
    Ok(serde_json::to_string_pretty(&root)? + "\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    const BIN: &str = "/usr/local/bin/termenbox-server";

    fn tmpdir() -> tempfile::TempDir {
        tempdir().unwrap()
    }

    #[test]
    fn claude_hooks_connect_and_disconnect() {
        let dir = tmpdir();
        let config = HookConfig::new(
            AgentKind::Claude,
            BIN.into(),
            "test".into(),
            "token".into(),
            dir.path(),
            crate::backend::Runner::default(),
        );
        let settings = config.settings_path.clone();

        // Connect
        let hooks = ClaudeHooks;
        let out = hooks.connect(&config, true).unwrap();
        assert!(out.contains("Connected"));
        assert!(settings.exists());

        // Verify hooks present
        let content = fs::read_to_string(&settings).unwrap();
        assert!(content.contains(MARKER));
        for e in EVENTS {
            assert!(content.contains(e), "missing event {e}");
        }

        // Disconnect
        let out = hooks.disconnect(&config).unwrap();
        assert!(out.contains("Disconnected"));
        let content = fs::read_to_string(&settings).unwrap();
        assert!(!content.contains(MARKER));
    }

    #[test]
    fn claude_hooks_idempotent() {
        let dir = tmpdir();
        let config = HookConfig::new(
            AgentKind::Claude,
            BIN.into(),
            "test".into(),
            "token".into(),
            dir.path(),
            crate::backend::Runner::default(),
        );
        let settings = config.settings_path.clone();

        let hooks = ClaudeHooks;
        hooks.connect(&config, true).unwrap();
        let first = fs::read_to_string(&settings).unwrap();
        hooks.connect(&config, true).unwrap();
        let second = fs::read_to_string(&settings).unwrap();
        assert_eq!(first, second, "connect should be idempotent");
    }

    #[test]
    fn claude_hooks_preserves_existing_settings() {
        let dir = tmpdir();
        let config = HookConfig::new(
            AgentKind::Claude,
            BIN.into(),
            "test".into(),
            "token".into(),
            dir.path(),
            crate::backend::Runner::default(),
        );
        let settings = config.settings_path.clone();
        
        // Create parent directory first
        std::fs::create_dir_all(settings.parent().unwrap()).unwrap();
        
        let existing = r#"{"model": "opus", "hooks": {"PreToolUse": [{"matcher": "Bash", "hooks": [{"type": "command", "command": "my-linter"}]}]}}"#;
        fs::write(&settings, existing).unwrap();

        let hooks = ClaudeHooks;
        hooks.connect(&config, true).unwrap();
        let content = fs::read_to_string(&settings).unwrap();
        assert!(content.contains("opus"));
        assert!(content.contains("my-linter"));
        // Our hooks added
        for e in EVENTS {
            assert!(content.contains(e), "missing event {e}");
        }
    }
}