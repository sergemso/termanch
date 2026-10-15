//! Codex hooks: edits ~/.codex/config.toml (TOML format with inline hooks)
use std::path::{Path, PathBuf};

use anyhow::{anyhow, Result};
use toml_edit::{value, Array, ArrayOfTables, DocumentMut, Item, Table, Value as TomlValue};

use super::{AgentHooks, AgentKind, HookConfig};

/// Codex uses TOML config with PascalCase event names (compatible with Claude Code).
const EVENTS: [(&str, Option<&str>); 6] = [
    ("SessionStart", Some("startup|resume")),
    ("UserPromptSubmit", None),
    ("PreToolUse", Some("^Bash$")),
    ("PostToolUse", Some("^Bash$")),
    ("Notification", None),
    ("Stop", None),
];

/// Marker to identify our entries.
const MARKER: &str = "--hook codex";

pub struct CodexHooks;

impl AgentHooks for CodexHooks {
    fn kind(&self) -> AgentKind {
        AgentKind::Codex
    }

    fn default_settings_path(&self, home: &Path) -> PathBuf {
        home.join(".codex/config.toml")
    }

    fn preview(&self, config: &HookConfig) -> String {
        let mut doc = DocumentMut::new();
        let hook_cmd = config.hook_command();

        let mut hooks_table = Table::new();

        for (event_name, matcher) in EVENTS {
            let mut event_array = ArrayOfTables::new();
            let mut entry = Table::new();
            if let Some(m) = matcher {
                entry.insert("matcher", value(m));
            }
            let mut hooks_arr = Array::new();
            let mut hook = toml_edit::InlineTable::new();
            hook.insert(
                "type",
                TomlValue::String(toml_edit::Formatted::new("command".to_string())),
            );
            hook.insert(
                "command",
                TomlValue::String(toml_edit::Formatted::new(hook_cmd.clone())),
            );
            hook.insert("timeout", TomlValue::Integer(toml_edit::Formatted::new(30)));
            hooks_arr.push(TomlValue::InlineTable(hook));
            entry.insert("hooks", Item::Value(TomlValue::Array(hooks_arr)));
            event_array.push(entry);
            hooks_table.insert(event_name, Item::ArrayOfTables(event_array));
        }

        doc["hooks"] = Item::Table(hooks_table);

        // Also set features.hooks = true
        let mut features = toml_edit::InlineTable::new();
        features.insert("hooks", TomlValue::Boolean(toml_edit::Formatted::new(true)));
        doc["features"] = Item::Value(TomlValue::InlineTable(features));

        doc.to_string()
    }

    fn connect(&self, config: &HookConfig, apply: bool) -> Result<String> {
        let settings = &config.settings_path;
        let before = std::fs::read_to_string(settings).unwrap_or_default();

        let mut doc = before
            .parse::<DocumentMut>()
            .unwrap_or_else(|_| DocumentMut::new());

        // Ensure hooks table exists
        let hooks_table = doc.entry("hooks").or_insert(Item::Table(Table::new()));
        let hooks_table = hooks_table
            .as_table_mut()
            .ok_or_else(|| anyhow!("hooks is not a table"))?;

        let hook_cmd = config.hook_command();

        for (event_name, matcher) in EVENTS {
            let event_array = hooks_table
                .entry(event_name)
                .or_insert(Item::ArrayOfTables(ArrayOfTables::new()));
            let event_array = event_array
                .as_array_of_tables_mut()
                .ok_or_else(|| anyhow!("{event_name} is not an array of tables"))?;

            // Check if our hook already exists
            let exists = event_array.iter().any(|t| {
                t.get("hooks")
                    .and_then(|h| h.as_array())
                    .map(|arr| {
                        arr.iter().any(|hook| {
                            hook.as_inline_table()
                                .and_then(|it| it.get("command"))
                                .and_then(|v| v.as_str())
                                .map(|s| s.contains(MARKER))
                                .unwrap_or(false)
                        })
                    })
                    .unwrap_or(false)
            });

            if !exists {
                let mut entry = Table::new();
                if let Some(m) = matcher {
                    entry.insert("matcher", value(m));
                }
                let mut hooks_arr = Array::new();
                let mut hook = toml_edit::InlineTable::new();
                hook.insert(
                    "type",
                    TomlValue::String(toml_edit::Formatted::new("command".to_string())),
                );
                hook.insert(
                    "command",
                    TomlValue::String(toml_edit::Formatted::new(hook_cmd.clone())),
                );
                hook.insert("timeout", TomlValue::Integer(toml_edit::Formatted::new(30)));
                hooks_arr.push(TomlValue::InlineTable(hook));
                entry.insert("hooks", Item::Value(TomlValue::Array(hooks_arr)));
                event_array.push(entry);
            }
        }

        // Also set features.hooks = true if not set
        let features = doc.entry("features").or_insert(Item::Table(Table::new()));
        let features = features
            .as_table_mut()
            .ok_or_else(|| anyhow!("features is not a table"))?;
        features.insert("hooks", value(true));

        let merged = doc.to_string();

        if !apply {
            return Ok(format!(
                "Would add hooks to {} (nothing else changes):\n{}",
                settings.display(),
                self.preview(config)
            ));
        }

        std::fs::create_dir_all(settings.parent().unwrap_or(Path::new(".")))?;
        std::fs::write(settings, merged)?;
        Ok(format!(
            "Connected: hooks added to {}. Undo with --disconnect {}.",
            settings.display(),
            self.kind().as_str()
        ))
    }

    fn disconnect(&self, config: &HookConfig) -> Result<String> {
        let settings = &config.settings_path;
        let content = std::fs::read_to_string(settings)
            .map_err(|e| anyhow!("cannot read {}: {e}", settings.display()))?;

        let mut doc = content
            .parse::<DocumentMut>()
            .map_err(|e| anyhow!("invalid TOML in {}: {e}", settings.display()))?;

        // First check if hooks table exists and is empty
        let hooks_empty = doc
            .get("hooks")
            .and_then(|t| t.as_table())
            .map(|t| t.is_empty())
            .unwrap_or(true);

        if let Some(hooks_table) = doc.get_mut("hooks").and_then(|t| t.as_table_mut()) {
            // Collect event names first to avoid borrow issues
            let event_names: Vec<String> = hooks_table.iter().map(|(k, _)| k.to_string()).collect();
            for event_name in event_names {
                if let Some(event_array) = hooks_table
                    .get_mut(&event_name)
                    .and_then(|t| t.as_array_of_tables_mut())
                {
                    // Filter out our hooks
                    let mut to_remove = Vec::new();
                    for (idx, entry) in event_array.iter().enumerate() {
                        let is_ours = entry
                            .get("hooks")
                            .and_then(|h| h.as_array())
                            .map(|arr| {
                                arr.iter().any(|hook| {
                                    hook.as_inline_table()
                                        .and_then(|it| it.get("command"))
                                        .and_then(|v| v.as_str())
                                        .map(|s| s.contains(MARKER))
                                        .unwrap_or(false)
                                })
                            })
                            .unwrap_or(false);
                        if is_ours {
                            to_remove.push(idx);
                        }
                    }
                    // Remove in reverse order to keep indices valid
                    for idx in to_remove.into_iter().rev() {
                        event_array.remove(idx);
                    }
                    // Remove empty arrays
                    if event_array.is_empty() {
                        hooks_table.remove(&event_name);
                    }
                }
            }
            // Remove empty hooks table
            if hooks_table.is_empty() {
                doc.remove("hooks");
            }
        }

        // Also clean up features.hooks if no other hooks remain
        if hooks_empty {
            if let Some(features) = doc.get_mut("features").and_then(|t| t.as_table_mut()) {
                features.remove("hooks");
                if features.is_empty() {
                    doc.remove("features");
                }
            }
        }

        std::fs::write(settings, doc.to_string())?;
        Ok(format!(
            "Disconnected: removed only Termenbox's hooks from {}; your other changes stay.",
            settings.display()
        ))
    }

    fn is_connected(&self, config: &HookConfig) -> bool {
        let settings = &config.settings_path;
        std::fs::read_to_string(settings)
            .ok()
            .and_then(|s| s.parse::<DocumentMut>().ok())
            .map(|doc| {
                doc.get("hooks")
                    .and_then(|t| t.as_table())
                    .map(|hooks| {
                        hooks.iter().any(|(_, event_val)| {
                            event_val
                                .as_array_of_tables()
                                .map(|arr| {
                                    arr.iter().any(|entry| {
                                        entry
                                            .get("hooks")
                                            .and_then(|h| h.as_array())
                                            .map(|hooks_arr| {
                                                hooks_arr.iter().any(|hook| {
                                                    hook.as_inline_table()
                                                        .and_then(|it| it.get("command"))
                                                        .and_then(|v| v.as_str())
                                                        .map(|s| s.contains(MARKER))
                                                        .unwrap_or(false)
                                                })
                                            })
                                            .unwrap_or(false)
                                    })
                                })
                                .unwrap_or(false)
                        })
                    })
                    .unwrap_or(false)
            })
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn tmpdir() -> tempfile::TempDir {
        tempdir().unwrap()
    }

    #[test]
    fn codex_hooks_connect_and_disconnect() {
        let dir = tmpdir();
        let config = HookConfig::new(
            AgentKind::Codex,
            "/bin/termenbox-server".into(),
            "test".into(),
            "token".into(),
            dir.path(),
            crate::backend::Runner::default(),
        );
        let settings = config.settings_path.clone();

        let hooks = CodexHooks;
        let out = hooks.connect(&config, true).unwrap();
        assert!(out.contains("Connected"));
        assert!(settings.exists());

        // Verify hooks present
        let content = fs::read_to_string(&settings).unwrap();
        assert!(content.contains("--hook codex"));
        assert!(content.contains("SessionStart"));
        assert!(content.contains("UserPromptSubmit"));
        assert!(content.contains("PreToolUse"));
        assert!(content.contains("PostToolUse"));
        assert!(content.contains("Notification"));
        assert!(content.contains("Stop"));
        assert!(content.contains("hooks = true"));

        // Disconnect
        let out = hooks.disconnect(&config).unwrap();
        assert!(out.contains("Disconnected"));
        let content = fs::read_to_string(&settings).unwrap();
        assert!(!content.contains("--hook codex"));
    }

    #[test]
    fn codex_hooks_idempotent() {
        let dir = tmpdir();
        let config = HookConfig::new(
            AgentKind::Codex,
            "/bin/termenbox-server".into(),
            "test".into(),
            "token".into(),
            dir.path(),
            crate::backend::Runner::default(),
        );
        let settings = config.settings_path.clone();

        let hooks = CodexHooks;
        hooks.connect(&config, true).unwrap();
        let first = fs::read_to_string(&settings).unwrap();
        hooks.connect(&config, true).unwrap();
        let second = fs::read_to_string(&settings).unwrap();
        assert_eq!(first, second, "connect should be idempotent");
    }

    #[test]
    fn codex_hooks_preserves_existing() {
        let dir = tmpdir();
        let config = HookConfig::new(
            AgentKind::Codex,
            "/bin/termenbox-server".into(),
            "test".into(),
            "token".into(),
            dir.path(),
            crate::backend::Runner::default(),
        );
        let settings = config.settings_path.clone();

        // Create parent directory first
        std::fs::create_dir_all(settings.parent().unwrap()).unwrap();

        let existing = r#"
model = "gpt-4"
[features]
hooks = true
[[hooks.PreToolUse]]
matcher = "^Bash$"
[[hooks.PreToolUse.hooks]]
type = "command"
command = "my-linter"
timeout = 10
"#;
        fs::write(&settings, existing).unwrap();

        let hooks = CodexHooks;
        hooks.connect(&config, true).unwrap();
        let content = fs::read_to_string(&settings).unwrap();
        assert!(content.contains("my-linter"));
        assert!(content.contains("gpt-4"));
        assert!(content.contains("--hook codex"));
    }
}
