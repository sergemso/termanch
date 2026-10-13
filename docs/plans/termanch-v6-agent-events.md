# Termanch Plan: agent event layer (implemented 2026-10-13 except the items under Status; decision 0079 still needs the owner's acceptance)

Decisions: 0061 (state from process scans plus tool adapters), 0079 (hooks are opt-in; draft). Guardrails: `host-changes-are-journaled`, `internal-network-binding`, `security-secrets-handling`, `audit-logging-no-secrets`, `diagnostics-never-include-secrets`, `resource-constraints`. Feeds v7 (`termanch-v7-output-connectors.md`, steps O.*) and v8 (`termanch-v8-session-cards.md`, steps K.*). Nothing here is decided until the owner accepts it. A fresh session needs only this file, those artifacts and the repo.

Cold start: Rust server `packages/server` (`sessions.rs`, `backend.rs` with `SessionBackend` and `Runner`, `auth.rs`, `connection.rs`), wire types in `packages/core/src/protocol.rs` mirrored in `packages/client/src/lib/protocol.ts`, Svelte 5 client in `packages/client/src`. Use `npx --yes pnpm@9`. Tests: `cargo test --workspace`, `cd packages/client && npx --yes pnpm@9 test`; browser e2e as in `docs/plans/termanch-v4-ops-and-feedback.md`. The owner tests on an iPhone. Land each step as one squashed PR with green CI; merge only on the owner's "merge". The owner's own `termanch` container on the dev VPS must not be touched by tests. Step letters are P (free in v1-v5).

## Goal

Turn what each agent does into one small stream of typed events, whatever the tool, so cards, notifications and connectors never read raw terminal text.

## Sources, most precise first (each optional, the layer degrades gracefully)

| Source | Gives | Cost / risk |
|---|---|---|
| Tool hooks (Claude Code hooks: tool start/end, notification, stop) | exact tool, args summary, "needs input", done | a settings change in the user's home: explicit action, preview, backup, journal (0079); not in container mode unless the home is ours |
| Structured channels (herdr status API; Codex notify/JSON modes) | state, plan, messages | verify per tool in P.1. ACP is out of scope here (0079) |
| Process scan (0061) | which agent runs, idle or busy | the floor; needs no configuration |
| Screen heuristics (`tmux capture-pane`, prompt patterns) | "waiting for yes/no", best effort | brittle across versions; always low confidence |

## Event model

`AgentEvent { session, seq, ts, source, confidence, kind }`. `seq` is a per-session counter stamped by the server, and `ts` is the server's clock, never the hook's. Kinds: `state(idle|working|needs_input|done|error)`, `tool(name, summary, started|finished)`, `plan(items[{text,status}])`, `prompt(id, kind, choices[])`, `message(summary)`. A client that meets an unknown kind or field ignores it.

Rules every event obeys:

- **Agent text is untrusted.** Summaries and prompt text come from the agent and may carry injected instructions, control or escape characters, or secrets (`curl -H "Authorization: …"`). The server strips control characters, caps length (summary 120 chars, plan item 200, 20 items), and runs the v4 `report.ts` scrubber rules (certificates, claim secrets, tokens, addresses) before an event is stored or sent. The client renders it as text, never as markup.
- **No raw terminal text** by default, in events, audit entries or push payloads.
- **Staleness is explicit.** Each session keeps `last_event_at`; with no event for 60 s while `working`, the latest state is reported as `working` with `stale=true`, never kept forever.
- **Memory budget.** Ring of at most 50 events per session and 20 sessions with events (about 100 KB worst case); `capture-pane` is polled at most every 2 s, only for sessions a client is subscribed to or whose scan says `working`, and never faster than one pane per 250 ms. Measured in P.2 against the 512 MB / 1 vCPU limit.

## Steps

### P.1 Spike: what each tool really exposes — [ ]
Class: research · Needs: none · Check: `test -s docs/facts/0029-agent-tool-surfaces.md`
Context: Tool interfaces below are unverified. Run in a throwaway home on the VPS, not the owner's.
Do: 1. For Claude Code, Codex and herdr record the hook, JSON or status surface, the exact settings lines needed, and a real sample event for each of: tool started, needs input, done, and a crash or kill. 2. Record how a hook script can learn its session (an environment variable the server sets in the pane, for example `TERMANCH_SESSION` and `TERMANCH_EVENT_SOCKET`). 3. Record hook timeout behaviour and what happens to the agent when the hook command is missing or slow. 4. Decide per tool the primary source.
Done-when: fact 0029 has the table with all samples and the per-tool verdict.

### P.2 Event model, ingest socket and memory budget — [ ]
Class: implement · Needs: P.1 · Check: `cargo test -p termanch-core event && cargo test -p termanch-server events`
Context: Guardrails `internal-network-binding`, `audit-logging-no-secrets`.
Do: 1. Types in `termanch-core` with `serde(other)` handling of unknown kinds. 2. A Unix socket in the state directory, mode 0600, never TCP. Each session is given its own per-session token in its environment at creation; an event is accepted only if its token matches the session it names, so one session cannot write events for another. 3. Sanitiser: strip control characters, length caps, scrubber rules from the Event model. 4. Bounded per-session ring, staleness flag, `seq` stamping. 5. Audit entries (session, kind, source) without content. 6. A load test: 20 sessions at 20 events per second for a minute stays within the stated budget and under 5% of one core.
Done-when: unit tests prove token mismatch is refused, control characters and secrets are removed from samples, rings stay bounded, unknown kinds are ignored; the load test passes.

### P.3 Claude Code adapter via hooks — [ ]
Class: implement · Needs: P.2, decision 0079 accepted · Check: e2e with a scripted fake hook caller.
Context: Decision 0079. Guardrail `host-changes-are-journaled`.
Do: 1. An opt-in "Connect Claude Code" action that shows the exact lines to add to the user's hook settings, backs the file up, merges without touching other entries, journals the change, and has a Disconnect that removes only our entries. 2. The hook script has a 2 s timeout, exits 0 on any failure and when the socket is missing. 3. Never edited by an update.
Done-when: tests show the merge keeps unrelated settings, Disconnect restores the original bytes when nothing else changed, and the fake hook with the server stopped neither delays nor fails the caller.

### P.4 Process-scan and screen-heuristic fallback — [ ]
Class: implement · Needs: P.2 · Check: `cargo test -p termanch-server scan`
Do: 1. The 0061 scan as `state` events with `source=scan`. 2. Prompt heuristics as `prompt` events with `confidence=low` and a fresh prompt `id` each time the matched screen changes, covered by recorded screen fixtures per tool version.
Done-when: fixtures for each tool produce the expected states, a changed screen produces a new prompt id, and nothing from the screen text leaves the server except the capped summary.

### P.5 Codex and herdr adapters — [ ]
Class: implement · Needs: P.1, P.2 · Check: e2e with recorded samples from fact 0029.
Do: one adapter per tool on the surface P.1 chose, reading its structured channel and emitting events through the same ingest path and sanitiser.
Done-when: replaying each recorded sample yields the matching `state`, `tool` and `prompt` events; a tool without hooks still shows scan state.

### P.6 Protocol and client plumbing — [ ]
Class: implement · Needs: P.2 · Check: `cargo test -p termanch-core && cd packages/client && npx --yes pnpm@9 test`
Do: 1. Additive `ServerMessage::AgentEvent` and a `session list` field with the latest state, `seq` and `stale`. 2. Mirror in `protocol.ts`. 3. Client store only, no UI (UI is v8). 4. On reconnect the client gets the latest snapshot per session, then events with higher `seq`; a gap in `seq` triggers a new snapshot request.
Done-when: an old client ignores the new message in a test; reconnect yields the snapshot; a `seq` gap is recovered.

## Status (2026-10-13)

| Step | State | Evidence / what is left |
|---|---|---|
| P.1 | done | `docs/facts/0029-agent-tool-surfaces.md`: real Claude Code and herdr samples, tmux screens. Codex is not installed on the dev VPS: its row is documentation only |
| P.2 | done | `events.rs` (hub, sanitiser, socket), `termanch-core/src/events.rs`; unit tests, load test (24,000 events in about 0.8 s), `tests/hook_cli.rs` |
| P.3 | done as a command line action | `--connect-claude [--yes]` / `--disconnect-claude` (`claude_hooks.rs`); a real Claude Code run through the built hook reached a socket. Left: a UI button, and the owner accepting decision 0079. The change is recorded in the user's own `claude-hooks.json` beside a backup, not in the root-only system journal (that one is out of reach of the user the hooks belong to) |
| P.4 | done | `agentwatch.rs`, `adapters.rs`; recorded screens in `testdata/screens/`, a real tmux test. Only Claude Code screens are recorded; Codex and herdr prompts are not matched |
| P.5 | herdr done, Codex unverified | herdr status polled every 3 s (`agent list`, fixture-free because no real agent ran under herdr; the mapping is tested on the schema's values). The Codex adapter follows its documented notify shape against a hand-written sample and is not wired to any installer |
| P.6 | done | `ServerMessage::AgentSnapshot` / `AgentEvents`, `ClientMessage::AgentSync`, `src/lib/agents.ts`; e2e over WebSocket and WebRTC (`agent_events_flow_from_a_session_tool_to_the_client`) |

Measured: the memory estimate in "Rules every event obeys" was too low; 20 full rings are about 165 KB for typical events, under 500 KB at the length caps. CPU in the CI resource gate has not been re-measured with the scan running (one `tmux list-panes` per 2 s plus one `capture-pane` per agent session).

## Open questions for the owner (recommended default first)

1. Hooks installed by an explicit "Connect" action only (0079)? Recommended: yes; the scan floor works without it.
2. ACP out of scope here (0079)? Recommended: yes.
3. Ring of 50 events per session in memory only, nothing on disk? Recommended: yes.
