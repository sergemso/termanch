//! Mappers from what each tool reports to agent events (plan v6, P.3-P.5). Pure functions over the
//! tool's own data, so they are covered by recorded samples (`testdata/events/`). Text is not cleaned
//! here; the hub does that for every source.
use serde_json::Value;
use termanch_core::events::{AgentState, Confidence, EventKind, Source, ToolPhase};

pub type Adapted = (Source, Confidence, Vec<EventKind>);

pub fn adapt(adapter: &str, data: &Value) -> Option<Adapted> {
    match adapter {
        "claude" => claude(data),
        "codex" => codex(data),
        _ => None,
    }
}

fn state(s: AgentState) -> EventKind {
    EventKind::State { state: s }
}

fn text<'a>(v: &'a Value, key: &str) -> &'a str {
    v.get(key).and_then(Value::as_str).unwrap_or("")
}

/// What a tool call is about, without the whole input: a command's first line, or a file path.
fn tool_summary(name: &str, input: &Value) -> String {
    let pick = |k: &str| text(input, k).lines().next().unwrap_or("").to_string();
    match name {
        "Bash" => pick("command"),
        "Read" | "Edit" | "Write" | "MultiEdit" | "NotebookEdit" => pick("file_path"),
        "Grep" | "Glob" => pick("pattern"),
        "WebFetch" => pick("url"),
        _ => String::new(),
    }
}

/// Claude Code hook payloads (fact 0029). The prompt and tool output are never copied.
pub fn claude(d: &Value) -> Option<Adapted> {
    let kinds = match text(d, "hook_event_name") {
        "SessionStart" => vec![state(AgentState::Idle)],
        "UserPromptSubmit" => vec![state(AgentState::Working)],
        "PreToolUse" => {
            let name = text(d, "tool_name").to_string();
            let summary = tool_summary(&name, d.get("tool_input").unwrap_or(&Value::Null));
            vec![
                EventKind::Tool {
                    name,
                    summary,
                    phase: ToolPhase::Started,
                },
                state(AgentState::Working),
            ]
        }
        "PostToolUse" => {
            let name = text(d, "tool_name").to_string();
            let summary = tool_summary(&name, d.get("tool_input").unwrap_or(&Value::Null));
            vec![EventKind::Tool {
                name,
                summary,
                phase: ToolPhase::Finished,
            }]
        }
        "Notification" => vec![
            state(AgentState::NeedsInput),
            EventKind::Message {
                summary: text(d, "message").to_string(),
            },
        ],
        "Stop" => {
            let mut k = vec![state(AgentState::Done)];
            let last = text(d, "last_assistant_message");
            if !last.is_empty() {
                k.push(EventKind::Message {
                    summary: last.to_string(),
                });
            }
            k
        }
        _ => return None,
    };
    Some((Source::Hook, Confidence::High, kinds))
}

/// Codex `notify` program argument. UNVERIFIED: Codex is not installed where this was written, so the
/// shape follows its documentation (fact 0029) and the sample in testdata is hand-written.
pub fn codex(d: &Value) -> Option<Adapted> {
    match text(d, "type") {
        "agent-turn-complete" => {
            let mut k = vec![state(AgentState::Done)];
            let last = text(d, "last-assistant-message");
            if !last.is_empty() {
                k.push(EventKind::Message {
                    summary: last.to_string(),
                });
            }
            Some((Source::Codex, Confidence::Medium, k))
        }
        _ => None,
    }
}

/// herdr `agent list` output for one herdr session: the most urgent status among its agents.
pub fn herdr_state(json: &str) -> Option<AgentState> {
    let v: Value = serde_json::from_str(json).ok()?;
    let agents = v.pointer("/result/agents")?.as_array()?;
    let mut best: Option<AgentState> = None;
    let rank = |s: AgentState| match s {
        AgentState::NeedsInput => 4,
        AgentState::Working => 3,
        AgentState::Done => 2,
        _ => 1,
    };
    for a in agents {
        let s = match a.get("agent_status").and_then(Value::as_str)? {
            "blocked" => AgentState::NeedsInput,
            "working" => AgentState::Working,
            "done" => AgentState::Done,
            "idle" => AgentState::Idle,
            _ => continue,
        };
        if best.map(|b| rank(s) > rank(b)).unwrap_or(true) {
            best = Some(s);
        }
    }
    best
}

// ---------------------------------------------------------------------------------------------------
// Process scan (decision 0061): which agent runs in a session and whether it is busy
// ---------------------------------------------------------------------------------------------------

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct PaneScan {
    pub session: String,
    pub command: String,
    /// Seconds since the window last produced output.
    pub quiet_for: u64,
}

/// `tmux list-panes -a -F '#{session_name}|#{pane_current_command}|#{window_activity}'`
pub fn parse_panes(output: &str, now_s: u64) -> Vec<PaneScan> {
    output
        .lines()
        .filter_map(|l| {
            let mut f = l.split('|');
            let session = f.next()?.to_string();
            let command = f.next()?.to_string();
            let activity: u64 = f.next()?.trim().parse().ok()?;
            Some(PaneScan {
                session,
                command,
                quiet_for: now_s.saturating_sub(activity),
            })
        })
        .collect()
}

pub fn agent_name(command: &str) -> Option<&'static str> {
    let c = command.to_ascii_lowercase();
    ["claude", "codex", "herdr"]
        .into_iter()
        .find(|n| c == *n || c.starts_with(&format!("{n}-")))
}

/// Output in the last few seconds means busy; the floor, so always low confidence.
pub fn scan_state(p: &PaneScan) -> Option<AgentState> {
    agent_name(&p.command)?;
    Some(if p.quiet_for <= 3 {
        AgentState::Working
    } else {
        AgentState::Idle
    })
}

// ---------------------------------------------------------------------------------------------------
// Screen heuristics: "waiting for yes/no", best effort, always low confidence
// ---------------------------------------------------------------------------------------------------

/// The text that made the screen look like a question, if any. Looks only at the last lines.
pub fn detect_prompt(screen: &str) -> Option<String> {
    let lines: Vec<&str> = screen
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .collect();
    let tail = &lines[lines.len().saturating_sub(14)..];
    let has = |needle: &str| tail.iter().any(|l| l.to_ascii_lowercase().contains(needle));
    let yes_no_list = tail.iter().any(|l| {
        let l = l.trim_start_matches(|c: char| !c.is_ascii_alphanumeric());
        l.starts_with("1. Yes") || l.starts_with("1) Yes")
    }) && tail.iter().any(|l| {
        let l = l.trim_start_matches(|c: char| !c.is_ascii_alphanumeric());
        let mut c = l.chars();
        matches!(c.next(), Some('2'..='9'))
            && matches!(c.next(), Some('.' | ')'))
            && l[2..].trim_start().starts_with("No")
    });
    let inline = has("(y/n)") || has("[y/n]") || has("(yes/no)");
    if !(yes_no_list || inline) {
        return None;
    }
    // The question line: the last line that asks something.
    tail.iter()
        .rev()
        .find(|l| l.contains('?') || l.to_ascii_lowercase().contains("y/n"))
        .or(tail.last())
        .map(|l| l.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn sample(name: &str) -> Value {
        let p = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("testdata/events")
            .join(name);
        serde_json::from_str(&std::fs::read_to_string(&p).unwrap_or_else(|e| panic!("{p:?}: {e}")))
            .unwrap()
    }

    #[test]
    fn recorded_claude_hooks_map_to_state_tool_and_message_events() {
        let k = |f: &str| claude(&sample(f)).unwrap().2;
        assert_eq!(
            k("claude-userpromptsubmit.json"),
            vec![state(AgentState::Working)]
        );
        assert_eq!(
            k("claude-pretooluse.json"),
            vec![
                EventKind::Tool {
                    name: "Bash".into(),
                    summary: "echo hello".into(),
                    phase: ToolPhase::Started
                },
                state(AgentState::Working)
            ]
        );
        assert_eq!(
            k("claude-posttooluse.json"),
            vec![EventKind::Tool {
                name: "Bash".into(),
                summary: "echo hello".into(),
                phase: ToolPhase::Finished
            }]
        );
        assert_eq!(
            k("claude-stop.json"),
            vec![
                state(AgentState::Done),
                EventKind::Message {
                    summary: "The command printed `hello`. Done.".into()
                }
            ]
        );
        let n = k("claude-notification.json");
        assert_eq!(n[0], state(AgentState::NeedsInput));
        assert!(claude(&json!({"hook_event_name": "SomethingNew"})).is_none());
    }

    #[test]
    fn nothing_from_the_prompt_or_tool_output_is_copied() {
        for f in ["claude-userpromptsubmit.json", "claude-posttooluse.json"] {
            let d = sample(f);
            let out = serde_json::to_string(&claude(&d).unwrap().2).unwrap();
            assert!(!out.contains("Run the bash command"), "{f}");
            assert!(!out.contains("\"hello\""), "{f}");
        }
    }

    #[test]
    fn codex_turn_complete_is_done_and_other_notifications_are_ignored() {
        let (src, _, kinds) = codex(&sample("codex-notify.json")).unwrap();
        assert_eq!(src, Source::Codex);
        assert_eq!(kinds[0], state(AgentState::Done));
        assert!(codex(&json!({"type": "something-else"})).is_none());
    }

    #[test]
    fn herdr_status_maps_and_the_most_urgent_agent_wins() {
        let j = |s: &[&str]| {
            json!({"result": {"agents": s.iter().map(|x| json!({"agent_status": x})).collect::<Vec<_>>(), "type": "agent_list"}}).to_string()
        };
        assert_eq!(
            herdr_state(&j(&["idle", "working"])),
            Some(AgentState::Working)
        );
        assert_eq!(
            herdr_state(&j(&["done", "blocked", "working"])),
            Some(AgentState::NeedsInput)
        );
        assert_eq!(herdr_state(&j(&["idle"])), Some(AgentState::Idle));
        assert_eq!(herdr_state(&j(&["unknown"])), None);
        assert_eq!(herdr_state(&j(&[])), None);
        assert_eq!(herdr_state("not json"), None);
        let real = r#"{"id":"cli:agent:list","result":{"agents":[],"type":"agent_list"}}"#;
        assert_eq!(herdr_state(real), None);
    }

    #[test]
    fn the_scan_finds_agents_and_tells_busy_from_quiet() {
        let panes = parse_panes(
            "a|claude|1000\nb|bash|1000\nc|codex|900\nbad line\nd|node|x\n",
            1002,
        );
        assert_eq!(panes.len(), 3);
        assert_eq!(scan_state(&panes[0]), Some(AgentState::Working));
        assert_eq!(scan_state(&panes[1]), None);
        assert_eq!(scan_state(&panes[2]), Some(AgentState::Idle));
    }

    fn fixture(name: &str) -> String {
        let p = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("testdata/screens")
            .join(name);
        std::fs::read_to_string(&p).unwrap_or_else(|e| panic!("{p:?}: {e}"))
    }

    #[test]
    fn recorded_screens_are_recognised_as_questions_or_not() {
        assert!(detect_prompt(&fixture("claude-permission.txt"))
            .unwrap()
            .to_lowercase()
            .contains("proceed"));
        assert!(detect_prompt(&fixture("claude-idle.txt")).is_none());
        assert!(detect_prompt(&fixture("shell-yn.txt")).is_some());
        assert!(detect_prompt("hello\nworld").is_none());
        assert!(detect_prompt("").is_none());
    }
}
