//! The agent event model (plan v6, decision 0061): what each agent does, as one small typed stream.
//! Every enum has an `Unknown` fallback so an older peer ignores kinds and values it does not know.
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AgentState {
    Idle,
    Working,
    NeedsInput,
    Done,
    Error,
    #[serde(other)]
    Unknown,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ToolPhase {
    Started,
    Finished,
    #[serde(other)]
    Unknown,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Source {
    Hook,
    Herdr,
    Codex,
    Scan,
    Screen,
    #[serde(other)]
    Unknown,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Confidence {
    Low,
    Medium,
    High,
    #[serde(other)]
    Unknown,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct PlanItem {
    pub text: String,
    pub status: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum EventKind {
    State {
        state: AgentState,
    },
    Tool {
        name: String,
        summary: String,
        phase: ToolPhase,
    },
    Plan {
        items: Vec<PlanItem>,
    },
    Prompt {
        id: String,
        prompt_kind: String,
        choices: Vec<String>,
    },
    Message {
        summary: String,
    },
    #[serde(other)]
    Unknown,
}

/// `seq` is a per-session counter and `ts` the server's clock (ms since the epoch), both stamped by the
/// server and never taken from the source.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct AgentEvent {
    pub session: String,
    pub seq: u64,
    pub ts: u64,
    pub source: Source,
    pub confidence: Confidence,
    #[serde(flatten)]
    pub kind: EventKind,
}

/// The latest state of one session, for a client that has just connected.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct SessionAgentState {
    pub session: String,
    pub state: AgentState,
    pub seq: u64,
    /// No event for a while although the state is `working`: the state may be out of date.
    pub stale: bool,
    pub ts: u64,
    /// The agent in the session (`claude`, `codex`, `herdr`), from the process scan; absent for a plain shell and
    /// from older servers.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent: Option<String>,
    /// When the agent last answered (ms since the epoch): a finished turn, a reply message, or a working-to-idle
    /// change. Absent until it has.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_response_at: Option<u64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn events_round_trip_with_the_wire_names_the_client_reads() {
        let e = AgentEvent {
            session: "s".into(),
            seq: 3,
            ts: 9,
            source: Source::Hook,
            confidence: Confidence::High,
            kind: EventKind::Tool {
                name: "Bash".into(),
                summary: "ls".into(),
                phase: ToolPhase::Started,
            },
        };
        let v = serde_json::to_value(&e).unwrap();
        assert_eq!(v["kind"], "tool");
        assert_eq!(v["phase"], "started");
        assert_eq!(v["source"], "hook");
        assert_eq!(serde_json::from_value::<AgentEvent>(v).unwrap(), e);
    }

    #[test]
    fn a_snapshot_from_an_older_server_still_parses_and_the_new_fields_stay_off_the_wire_when_empty(
    ) {
        let old: SessionAgentState =
            serde_json::from_str(r#"{"session":"s","state":"idle","seq":1,"stale":false,"ts":5}"#)
                .unwrap();
        assert_eq!((old.agent, old.last_response_at), (None, None));
        let v = serde_json::to_value(&SessionAgentState {
            session: "s".into(),
            state: AgentState::Idle,
            seq: 1,
            stale: false,
            ts: 5,
            agent: None,
            last_response_at: None,
        })
        .unwrap();
        assert!(v.get("agent").is_none() && v.get("last_response_at").is_none());
    }

    #[test]
    fn unknown_kinds_and_values_are_ignored_not_fatal() {
        let e: AgentEvent = serde_json::from_str(
            r#"{"session":"s","seq":1,"ts":1,"source":"telepathy","confidence":"certain","kind":"hologram","x":1}"#,
        )
        .unwrap();
        assert_eq!(e.kind, EventKind::Unknown);
        assert_eq!(e.source, Source::Unknown);
        let s: EventKind =
            serde_json::from_str(r#"{"kind":"state","state":"levitating"}"#).unwrap();
        assert_eq!(
            s,
            EventKind::State {
                state: AgentState::Unknown
            }
        );
    }
}
