//! Kilo hooks: injects shell.env via plugin or config
//! Kilo doesn't have native hooks yet (issue #5827), so we inject via shell.env
//! to set TERMENBOX_* env vars, and optionally create a plugin for lifecycle events.
use std::path::{Path, PathBuf};

use anyhow::{anyhow, Result};
use serde_json::{json, Value};

use super::{AgentHooks, AgentKind, HookConfig};

/// Kilo config file location.
pub struct KiloHooks;

impl AgentHooks for KiloHooks {
    fn kind(&self) -> AgentKind {
        AgentKind::Kilo
    }

    fn default_settings_path(&self, home: &Path) -> PathBuf {
        // Kilo reads from ~/.config/kilo/kilo.jsonc (global) or project kilo.jsonc
        // We use the global one for user-level hooks
        home.join(".config/kilo/kilo.jsonc")
    }

    fn preview(&self, config: &HookConfig) -> String {
        let _hook_cmd = config.hook_command();
        // We inject TERMENBOX_SESSION and TERMENBOX_EVENT_TOKEN via shell.env
        // and add a plugin for lifecycle events if possible
        serde_json::to_string_pretty(&json!({
            "experimental": {
                "shellEnv": {
                    "TERMENBOX_SESSION": config.session_name,
                    "TERMENBOX_EVENT_TOKEN": config.token,
                    "TERMENBOX_EVENT_SOCKET": "/tmp/termenbox-events.sock" // placeholder
                }
            },
            "plugin": [{
                "name": "termenbox-hooks",
                "enabled": true
            }]
        })).unwrap()
    }

    fn connect(&self, config: &HookConfig, apply: bool) -> Result<String> {
        let settings = &config.settings_path;
        let before = std::fs::read_to_string(settings).unwrap_or_default();
        let merged = merge(&before, config)?;
        if !apply {
            return Ok(format!(
                "Would add shell.env and plugin to {} (nothing else changes):\n{}",
                settings.display(),
                self.preview(config)
            ));
        }
        std::fs::create_dir_all(settings.parent().unwrap_or(Path::new(".")))?;
        let tmp = settings.with_extension("json.termenbox-tmp");
        std::fs::write(&tmp, &merged)?;
        std::fs::rename(&tmp, settings)?;
        Ok(format!("Connected: shell.env and plugin added to {}. Undo with --disconnect {}.", settings.display(), self.kind().as_str()))
    }

    fn disconnect(&self, config: &HookConfig) -> Result<String> {
        let settings = &config.settings_path;
        let current = std::fs::read_to_string(settings)
            .map_err(|e| anyhow!("cannot read {}: {e}", settings.display()))?;
        let cleaned = remove(&current)?;
        std::fs::write(settings, cleaned)?;
        Ok(format!("Disconnected: removed Termenbox shell.env and plugin from {}; your other changes stay.", settings.display()))
    }

    fn is_connected(&self, config: &HookConfig) -> bool {
        let settings = &config.settings_path;
        std::fs::read_to_string(settings)
            .ok()
            .and_then(|s| parse_jsonc(&s))
            .map(|v| {
                // Check for TERMENBOX_* in shellEnv
                v.get("experimental")
                    .and_then(|e| e.get("shellEnv"))
                    .and_then(|se| se.as_object())
                    .map(|env| {
                        env.contains_key("TERMENBOX_SESSION") && env.contains_key("TERMENBOX_EVENT_TOKEN")
                    })
                    .unwrap_or(false)
            })
            .unwrap_or(false)
    }
}

/// Parse JSONC (JSON with comments) by stripping comments.
fn parse_jsonc(s: &str) -> Option<Value> {
    let stripped: String = s
        .lines()
        .map(|line| {
            let trimmed = line.trim_start();
            if trimmed.starts_with("//") || trimmed.starts_with("/*") {
                String::new()
            } else {
                // Remove inline comments
                line.split("//").next().unwrap_or(line).to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("\n");
    serde_json::from_str(&stripped).ok()
}

fn merge(existing: &str, config: &HookConfig) -> Result<String> {
    let mut root: Value = parse_jsonc(existing).unwrap_or_else(|| json!({}));
    
    let obj = root
        .as_object_mut()
        .ok_or_else(|| anyhow!("the settings file is not a JSON object"))?;
    
    // Add shell.env
    let experimental = obj.entry("experimental").or_insert_with(|| json!({}));
    let experimental = experimental.as_object_mut().ok_or_else(|| anyhow!("experimental is not an object"))?;
    let shell_env = experimental.entry("shellEnv").or_insert_with(|| json!({}));
    let shell_env = shell_env.as_object_mut().ok_or_else(|| anyhow!("shellEnv is not an object"))?;
    
    shell_env.insert("TERMENBOX_SESSION".into(), json!(config.session_name));
    shell_env.insert("TERMENBOX_EVENT_TOKEN".into(), json!(config.token));
    shell_env.insert("TERMENBOX_EVENT_SOCKET".into(), json!("/tmp/termenbox-events.sock"));
    
    // Add plugin (idempotent)
    let plugins = obj.entry("plugin").or_insert_with(|| json!([]));
    let plugins = plugins.as_array_mut().ok_or_else(|| anyhow!("plugin is not an array"))?;
    
    let our_plugin = json!({"name": "termenbox-hooks", "enabled": true});
    let has_ours = plugins.iter().any(|p| p.get("name").and_then(|n| n.as_str()) == Some("termenbox-hooks"));
    if !has_ours {
        plugins.push(our_plugin);
    }
    
    // Write back as JSONC (we lose comments, but that's acceptable for automation)
    Ok(serde_json::to_string_pretty(&root)? + "\n")
}

fn remove(existing: &str) -> Result<String> {
    let mut root = parse_jsonc(existing).unwrap_or_else(|| json!({}));
    
    // Remove TERMENBOX_* from shellEnv
    if let Some(experimental) = root.get_mut("experimental").and_then(|e| e.as_object_mut()) {
        if let Some(shell_env) = experimental.get_mut("shellEnv").and_then(|se| se.as_object_mut()) {
            shell_env.remove("TERMENBOX_SESSION");
            shell_env.remove("TERMENBOX_EVENT_TOKEN");
            shell_env.remove("TERMENBOX_EVENT_SOCKET");
            if shell_env.is_empty() {
                experimental.remove("shellEnv");
            }
        }
        if experimental.is_empty() {
            root.as_object_mut().unwrap().remove("experimental");
        }
    }
    
    // Remove our plugin
    if let Some(plugins) = root.get_mut("plugin").and_then(|p| p.as_array_mut()) {
        plugins.retain(|p| p.get("name").and_then(|n| n.as_str()) != Some("termenbox-hooks"));
        if plugins.is_empty() {
            root.as_object_mut().unwrap().remove("plugin");
        }
    }
    
    Ok(serde_json::to_string_pretty(&root)? + "\n")
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
    fn kilo_hooks_connect_and_disconnect() {
        let dir = tmpdir();
        let config = HookConfig::new(
            AgentKind::Kilo,
            "/bin/termenbox-server".into(),
            "test".into(),
            "token".into(),
            dir.path(),
            crate::backend::Runner::default(),
        );
        let settings = config.settings_path.clone();

        let hooks = KiloHooks;
        let out = hooks.connect(&config, true).unwrap();
        assert!(out.contains("Connected"));
        assert!(settings.exists());

        // Verify hooks present
        let content = fs::read_to_string(&settings).unwrap();
        assert!(content.contains("TERMENBOX_SESSION"));
        assert!(content.contains("test"));
        assert!(content.contains("TERMENBOX_EVENT_TOKEN"));
        assert!(content.contains("token"));
        assert!(content.contains("termenbox-hooks"));

        // Disconnect
        let out = hooks.disconnect(&config).unwrap();
        assert!(out.contains("Disconnected"));
        let content = fs::read_to_string(&settings).unwrap();
        assert!(!content.contains("TERMENBOX_SESSION"));
        assert!(!content.contains("TERMENBOX_EVENT_TOKEN"));
        assert!(!content.contains("termenbox-hooks"));
    }

    #[test]
    fn kilo_hooks_idempotent() {
        let dir = tmpdir();
        let config = HookConfig::new(
            AgentKind::Kilo,
            "/bin/termenbox-server".into(),
            "test".into(),
            "token".into(),
            dir.path(),
            crate::backend::Runner::default(),
        );
        let settings = config.settings_path.clone();

        let hooks = KiloHooks;
        hooks.connect(&config, true).unwrap();
        let first = fs::read_to_string(&settings).unwrap();
        hooks.connect(&config, true).unwrap();
        let second = fs::read_to_string(&settings).unwrap();
        assert_eq!(first, second, "connect should be idempotent");
    }

    #[test]
    fn kilo_hooks_preserves_existing() {
        let dir = tmpdir();
        let config = HookConfig::new(
            AgentKind::Kilo,
            "/bin/termenbox-server".into(),
            "test".into(),
            "token".into(),
            dir.path(),
            crate::backend::Runner::default(),
        );
        let settings = config.settings_path.clone();
        
        // Create parent directory first
        std::fs::create_dir_all(settings.parent().unwrap()).unwrap();
        
        let existing = r#"{
  "model": "gpt-4",
  "experimental": {
    "shellEnv": {
      "CUSTOM_VAR": "value"
    }
  },
  "plugin": [{"name": "other-plugin", "enabled": true}]
}"#;
        fs::write(&settings, existing).unwrap();

        let hooks = KiloHooks;
        hooks.connect(&config, true).unwrap();
        let content = fs::read_to_string(&settings).unwrap();
        assert!(content.contains("CUSTOM_VAR"));
        assert!(content.contains("value"));
        assert!(content.contains("other-plugin"));
        assert!(content.contains("TERMENBOX_SESSION"));
    }

    #[test]
    fn jsonc_parsing_strips_comments() {
        let with_comments = r#"{
  // This is a comment
  "key": "value",
  "key2": "value2"
}"#;
        let parsed = parse_jsonc(with_comments).unwrap();
        assert_eq!(parsed["key"], "value");
        assert_eq!(parsed["key2"], "value2");
    }
}