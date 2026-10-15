//! "Connect Claude Code" (plan v6, P.3, decision 0079): adds Termenbox's hook entries to the user's Claude
//! Code settings, only when asked, only ours, with a backup and a journal; "Disconnect" removes only ours.
use std::path::{Path, PathBuf};

use anyhow::{anyhow, Result};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

pub const EVENTS: [&str; 6] = [
    "SessionStart",
    "UserPromptSubmit",
    "PreToolUse",
    "PostToolUse",
    "Notification",
    "Stop",
];
/// Marks an entry as ours; `remove` touches nothing else.
const MARKER: &str = "--hook claude";

pub fn hook_command(binary: &str) -> String {
    format!("{binary} {MARKER}")
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

/// The lines shown to the user before anything is written.
pub fn preview(binary: &str) -> String {
    let entry =
        json!({"hooks": [{"type": "command", "command": hook_command(binary), "timeout": 2}]});
    let mut hooks = serde_json::Map::new();
    for e in EVENTS {
        hooks.insert(e.into(), json!([entry]));
    }
    serde_json::to_string_pretty(&json!({"hooks": hooks})).unwrap()
}

/// Adds our entry to each event unless it is already there; everything else is kept as it is.
pub fn merge(existing: &str, binary: &str) -> Result<String> {
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
    let entry =
        json!({"hooks": [{"type": "command", "command": hook_command(binary), "timeout": 2}]});
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

/// Removes our entries and whatever became empty because of that.
pub fn remove(existing: &str) -> Result<String> {
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

fn sha(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

pub fn default_settings_path() -> PathBuf {
    PathBuf::from(std::env::var_os("HOME").unwrap_or_default()).join(".claude/settings.json")
}

/// The user-scope journal of this one change: where the backup is and what the file hashed to after.
fn journal_path(dir: &Path) -> PathBuf {
    dir.join("claude-hooks.json")
}

pub struct Outcome(pub String);

/// With `apply == false` only the preview is returned (the dry run the guardrail asks for).
pub fn connect(settings: &Path, binary: &str, state_dir: &Path, apply: bool) -> Result<Outcome> {
    let before = std::fs::read(settings).ok();
    let text = before
        .as_deref()
        .map(|b| String::from_utf8_lossy(b).into_owned())
        .unwrap_or_default();
    let merged = merge(&text, binary)?;
    if !apply {
        return Ok(Outcome(format!(
            "Would add these hooks to {} (nothing else changes; a backup is kept):\n{}\nRun again with --yes to apply.",
            settings.display(),
            preview(binary)
        )));
    }
    std::fs::create_dir_all(state_dir)?;
    let jp = journal_path(state_dir);
    // Keep the first backup: a second connect must not overwrite the original bytes.
    let backup = state_dir.join("claude-settings.backup");
    let prior: Option<Value> = std::fs::read_to_string(&jp)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok());
    if prior.is_none() {
        if let Some(b) = &before {
            std::fs::write(&backup, b)?;
        }
    }
    if let Some(parent) = settings.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = settings.with_extension("json.termenbox-tmp");
    std::fs::write(&tmp, &merged)?;
    std::fs::rename(&tmp, settings)?;
    let entry = prior.unwrap_or_else(|| {
        json!({
            "settings": settings.display().to_string(),
            "existed": before.is_some(),
            "backup": backup.display().to_string(),
            "before_sha256": before.as_deref().map(sha),
        })
    });
    let mut entry = entry;
    entry["after_sha256"] = json!(sha(merged.as_bytes()));
    std::fs::write(&jp, serde_json::to_string_pretty(&entry)?)?;
    Ok(Outcome(format!(
        "Connected: hooks added to {}. Undo with --disconnect-claude.",
        settings.display()
    )))
}

/// Restores the original bytes when only we have changed the file since; otherwise removes just our entries.
pub fn disconnect(settings: &Path, state_dir: &Path) -> Result<Outcome> {
    let current =
        std::fs::read(settings).map_err(|e| anyhow!("cannot read {}: {e}", settings.display()))?;
    let jp = journal_path(state_dir);
    let journal: Option<Value> = std::fs::read_to_string(&jp)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok());
    let untouched =
        journal.as_ref().and_then(|j| j["after_sha256"].as_str()) == Some(sha(&current).as_str());
    if let (true, Some(j)) = (untouched, &journal) {
        if j["existed"] == json!(true) {
            std::fs::copy(j["backup"].as_str().unwrap_or_default(), settings)?;
        } else {
            std::fs::remove_file(settings)?;
        }
        let _ = std::fs::remove_file(&jp);
        return Ok(Outcome(
            "Disconnected: the settings file is back to what it was.".into(),
        ));
    }
    let cleaned = remove(&String::from_utf8_lossy(&current))?;
    std::fs::write(settings, cleaned)?;
    let _ = std::fs::remove_file(&jp);
    Ok(Outcome(
        "Disconnected: removed only Termenbox's hooks; your other changes stay.".into(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    const BIN: &str = "/usr/local/bin/termenbox-server";
    const MINE: &str = r#"{
  "model": "opus",
  "hooks": {
    "PreToolUse": [{"matcher": "Bash", "hooks": [{"type": "command", "command": "my-linter"}]}],
    "Custom": [{"hooks": []}]
  }
}
"#;

    fn tmpdir(n: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("tm-ch-{n}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn merge_keeps_unrelated_settings_and_is_idempotent() {
        let m = merge(MINE, BIN).unwrap();
        let v: Value = serde_json::from_str(&m).unwrap();
        assert_eq!(v["model"], "opus");
        assert_eq!(
            v["hooks"]["PreToolUse"][0]["hooks"][0]["command"],
            "my-linter"
        );
        assert_eq!(v["hooks"]["PreToolUse"].as_array().unwrap().len(), 2);
        assert_eq!(v["hooks"]["Custom"], json!([{"hooks": []}]));
        for e in EVENTS {
            assert!(v["hooks"][e].as_array().unwrap().iter().any(is_ours), "{e}");
        }
        assert_eq!(merge(&m, BIN).unwrap(), m);
        assert!(merge("[1]", BIN).is_err());
    }

    #[test]
    fn remove_takes_out_only_ours() {
        let back: Value =
            serde_json::from_str(&remove(&merge(MINE, BIN).unwrap()).unwrap()).unwrap();
        assert_eq!(back, serde_json::from_str::<Value>(MINE).unwrap());
        assert_eq!(
            serde_json::from_str::<Value>(&remove(&merge("", BIN).unwrap()).unwrap()).unwrap(),
            json!({})
        );
    }

    #[test]
    fn disconnect_restores_the_original_bytes_when_nothing_else_changed() {
        let d = tmpdir("a");
        let settings = d.join("settings.json");
        std::fs::write(&settings, MINE).unwrap();
        assert!(connect(&settings, BIN, &d.join("state"), false)
            .unwrap()
            .0
            .contains("--yes"));
        assert_eq!(
            std::fs::read_to_string(&settings).unwrap(),
            MINE,
            "a dry run changes nothing"
        );
        connect(&settings, BIN, &d.join("state"), true).unwrap();
        assert!(std::fs::read_to_string(&settings).unwrap().contains(MARKER));
        connect(&settings, BIN, &d.join("state"), true).unwrap();
        disconnect(&settings, &d.join("state")).unwrap();
        assert_eq!(std::fs::read(&settings).unwrap(), MINE.as_bytes());
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn disconnect_after_the_user_edited_the_file_keeps_their_edit() {
        let d = tmpdir("b");
        let settings = d.join("settings.json");
        std::fs::write(&settings, MINE).unwrap();
        connect(&settings, BIN, &d.join("state"), true).unwrap();
        let edited = std::fs::read_to_string(&settings)
            .unwrap()
            .replace("\"opus\"", "\"sonnet\"");
        std::fs::write(&settings, edited).unwrap();
        disconnect(&settings, &d.join("state")).unwrap();
        let v: Value = serde_json::from_str(&std::fs::read_to_string(&settings).unwrap()).unwrap();
        assert_eq!(v["model"], "sonnet");
        assert!(!serde_json::to_string(&v).unwrap().contains(MARKER));
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn connecting_when_no_settings_file_exists_creates_and_disconnect_removes_it() {
        let d = tmpdir("c");
        let settings = d.join("home/.claude/settings.json");
        connect(&settings, BIN, &d.join("state"), true).unwrap();
        assert!(settings.exists());
        disconnect(&settings, &d.join("state")).unwrap();
        assert!(!settings.exists());
        let _ = std::fs::remove_dir_all(&d);
    }
}
