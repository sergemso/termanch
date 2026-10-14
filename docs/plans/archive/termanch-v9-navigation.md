> Archived 2026-10-14. Every open step was moved into `docs/plans/termanch-roadmap.md` (see the `[>]` markers); this file is history.

# Termanch Plan: navigation, session views and auto-connect

Decisions: 0082 (navigation, supersedes 0070), 0083 (cache expiry and the status line forwarder), 0084 (snapshot on tab switch), 0079 (hooks are opt-in; draft, its consent covers 0083). Facts: 0029, 0031. Guardrails: `ui-never-moves-under-the-finger`, `user-settings-are-wrapped-not-replaced`, `connections-warn-never-drop`, `kill-session-needs-confirmation`, `soft-keyboard-never-hides-input`, `host-changes-are-journaled`, `diagnostics-never-include-secrets`. Builds on `termanch-v6-agent-events.md` (events) and `termanch-v8-session-cards.md` (cards). Step letters are G. A fresh session needs only this file, those artifacts and the repo.

Cold start: Rust server `packages/server` (`sessions.rs`, `backend.rs` with `SessionBackend`/`CompositeBackend`/`TmuxBackend`, `events.rs`, `agentwatch.rs`, `adapters.rs`, `claude_hooks.rs`), wire types in `packages/core/src/protocol.rs` mirrored in `packages/client/src/lib/protocol.ts`, Svelte 5 client in `packages/client/src` (`App.svelte` uses `lib/hub.ts` to own one connection per saved server; `SessionSheet.svelte` applies the views in `lib/views.ts` to the v8 `SessionCard.svelte` cards; `NavigationBar.svelte`/`TabStrip.svelte` show all sessions; `lib/connection.ts`, `lib/agents.ts`, `lib/cards.ts`, `ServerList.svelte`, `AddServerModal.svelte`). Use `npx --yes pnpm@9`. Tests: `cargo test --workspace`, `cd packages/client && npx --yes pnpm@9 test`; browser checks `node e2e/run.mjs`, `e2e/touch.mjs`, `e2e/cards.mjs` after `pnpm --filter termanch-client run e2e:build` (Chromium: set `CHROME_PATH`, see `docs/plans/termanch-v4-ops-and-feedback.md`). The owner tests on an iPhone; do not claim a phone behaviour is verified from emulated Chrome alone. One squashed PR per step from its own branch off master, green CI, merge only on the owner's "merge". The owner's own `termanch` container on the dev VPS must not be touched.

## Goal

Open the app and see, at once, every agent on every server and which ones wait for you; switch to any of them in one touch; never connect by hand.

## Design in one place

- Top bar (phone): ☰ menu | scrolling tab strip, one tab per session across servers, needs-you tabs first while untouched | Sessions button with the needs-you count. Sessions sheet from the bottom (peek, half, full); docked sidebar on wide screens.
- Views: presets Needs me, Working, Cache expiring, Recent, By server; free group (server, agent, status, none), sort, filter; adaptive default; remembered per device.
- Proactive: needs-you banner, tab-title and app badge count, cache-expiring nudge (Keep warm is one deliberate tap), per-server degraded notices. Nothing switches the active tab.
- Switching: `peek` snapshot on touch-down, then live attach (0084).

## Steps

### G.1 Server reports each session's agent and last response — [x]‖
Class: implement · Needs: none · Check: `cargo test -p termanch-core && cargo test -p termanch-server events`
Context: `SessionAgentState` in `packages/core/src/events.rs` has session, state, seq, stale, ts. `agentwatch.rs::scan_tmux_once` knows each pane's command (`adapters::agent_name`) and `EventHub` (`events.rs`) knows every event's time. Group-by-agent and sort-by-recent (0082) need both per session.
Do: 1. Add `agent: Option<String>` (claude, codex, herdr, shell) and `last_response_at: Option<u64>` (ms) to `SessionAgentState`, `#[serde(default)]`, mirrored in `protocol.ts`. 2. The scan records the agent name per session in the hub; a response time is the time of the last `Done`/`Message` event or the last `Working`→`Idle`/`Done` transition from any source. 3. `EventHub::snapshot_at` fills both. 4. Unit tests for each source and for an old client ignoring the fields.
Done-when: tests show a scanned `claude` pane reports `agent=claude`, a Stop hook sets `last_response_at`, a scan-only working→idle change sets it, and a snapshot without events leaves both empty.

### G.2 Server `peek`: a pane snapshot on request — [x]‖
Class: implement · Needs: none · Check: `cargo test -p termanch-server peek`
Context: Decision 0084. `SessionBackend::capture` exists (`backend.rs`, tmux `capture-pane -p`); `CompositeBackend` delegates it by `manager:name` id.
Do: 1. Add `ClientMessage::Peek {session, hash: Option<String>}` and `ServerMessage::Snapshot {session, text, hash, unchanged}` to `packages/core/src/protocol.rs` and `protocol.ts`. 2. `TmuxBackend::capture_styled` uses `capture-pane -e -p`; the default trait method falls back to plain capture, herdr returns an error the client treats as "no snapshot". 3. The handler caps text at 16 KB and the pane size, answers `unchanged` with no text when `hash` matches (sha256, first 16 hex), and writes only a counter to the audit log, never text. 4. Tests with a fake backend (cap, unchanged, error) and a real tmux (colour codes survive).
Done-when: a real tmux pane that printed a coloured word returns it with its escape codes, a second `peek` with the returned hash is `unchanged`, and the audit log of the test run contains no pane text.

### G.3 Client: one connection per saved server, connected automatically — [x]
Class: implement · Needs: none · Check: `cd packages/client && npx --yes pnpm@9 test`
Context: Before G.3, `App.svelte` had a single `connection` created by `connectToServer`; `connectToServer` is called from `ServerList`. 0082 wants all saved servers connected at start, soft limit 6 (`connections-warn-never-drop`), Pause per server, heartbeat only while visible.
Do: 1. New `lib/hub.ts` (`ServerHub`): per saved server a `Connection`, its state and detail, its sessions, its agent map; `start(servers)`, `pause(id)`, `resume(id)`, `retry(id)`, `add`, `remove`; stores for `servers` (state per server) and `allSessions` (session with `serverId` and a global key `serverId/sessionId`). 2. App creates the hub at start and uses the existing per-connection `onReady` logic (list sessions, agent sync, re-attach the active one). 3. The soft-limit notice and Manage connections from 0070's guardrail. 4. `ServerList` becomes the empty state and the Servers page. 5. Tests with fake connections: all start, a pause disconnects only that one, a drop of one leaves the rest, over 6 shows the notice and drops nothing.
Done-when: unit tests prove the five behaviours above; with two fake servers the sessions store holds both servers' sessions with distinct keys; app start with saved servers shows no server list screen (browser check in G.10).

Verification (2026-10-13): fake-connection unit tests cover all-start, pause/resume, isolated drops/retry, warning above six, and duplicate local session ids across servers. Real Chromium app flow verifies saved-server auto-connect without a Connect screen, session taps, and returning to Servers without disconnecting. WebSocket/WebRTC tests verify `detach` preserves the connection and session. Phone layout and keyboard checks are emulated Chrome only; iPhone Safari/PWA foreground recovery and keyboard behaviour remain for the owner.

### G.4 Client: top bar, tab strip and menu — [x]
Class: implement · Needs: G.3 · Check: `cd packages/client && npx --yes pnpm@9 test`
Context: Decision 0082; guardrail `ui-never-moves-under-the-finger`. Before G.4, `App.svelte` showed ☰, the active session's name and a "Servers" button on phones, and Report, avatar and Logout in the header.
Do: 1. `TabStrip.svelte`: one tab per session from the hub, server badge when more than one server, status icon plus an accessible state word, a dot for needs-you, horizontal scroll with edge fade and the active tab scrolled into view, needs-you tabs first only while untouched (reuse `FrozenOrder`). 2. `MenuSheet.svelte` (☰): Servers, Settings (cache TTL, theme), Report a problem, Install/Update, account with avatar, Log out. 3. The Sessions button with the needs-you count. 4. Long-press a tab opens the action menu (G.9). 5. Tests: tab order and freezing, badge text, 44 px targets (extend `e2e/cards.mjs`).
Done-when: unit tests cover tab order with and without a touch down; the e2e shows 12 sessions on 3 fake servers as one scrolling strip with the active tab visible at 390 px and no control under 44 px.

Verification (2026-10-13): 166 client tests, preview/harness builds and the bundle gate pass. Real Chromium at 390 px shows 12 sessions on 3 fake connections in one strip with server badges, the active tab visible, needs-you count, 44 px controls, deferred insert/remove, and long-press actions without changing the active session. The real-server app flow passes through the new menu and tabs. Rename/Kill remain G.9. iPhone inertial tab scrolling, safe areas, native long-press and menu/keyboard interaction are unverified; phone checks used emulated Chrome.

### G.5 Client: the sessions sheet and the views — [x]
Class: implement · Needs: G.1, G.3 · Check: `cd packages/client && npx --yes pnpm@9 test`
Context: Before G.5, `SessionList.svelte` rendered v8 cards in the sidebar. Decision 0082 lists the presets.
Do: 1. `lib/views.ts`: pure functions `applyView(sessions, agents, view, now)` for group (server, agent, status, none), sort (human-needed, last response, cache expiry, name) and filter (status, agent, server), the five presets, the adaptive default, and persistence in `localStorage`. 2. `SessionSheet.svelte`: bottom sheet with three heights (drag handle, snap), sticky preset chips on top, group headers that carry server status and Retry; docked sidebar on wide screens. 3. Keep `FrozenOrder` semantics. 4. Tests for every preset and for persistence; keyboard-safe (`soft-keyboard-never-hides-input`).
Done-when: unit tests prove Needs me orders by longest wait, Recent by `last_response_at`, Cache expiring by remaining time (estimate from G.8 stubbed), group headers carry the server's state, and the adaptive default picks Needs me only when something needs you.

Verification (2026-10-13): 184 client tests, local preview/harness builds and the bundle gate pass. Real Chromium checks all three sheet heights and drag snapping, adaptive Needs me, server state/reason/Retry on group headers, frozen expanded prompts, custom grouping/sorting/server/text filters restored after reload, global-key reply routing, and desktop docking. Emulated Chrome viewport shrink and pan keep quick-reply input and terminal keys visible; input focus expands the sheet only after touch release. The isolated real-server app flow and terminal touch script pass. Cache ordering uses last-response/TTL estimates; exact G.8 expiry is injectable and stubbed in tests. iPhone Safari and installed-PWA sheet dragging, keyboard/rotation, safe areas and native gestures remain unverified; see `docs/skills/mobile-ui-device-check.md`.

Review fixes (2026-10-13): corrected claims replace only their connection; unavailable selections require a destination choice when multiple servers are connected; tabs and the sheet ignore releases from pointers they do not own; keyboard activation works after a long press. Needs me sorts by the continuous human-wait start, supplied as optional `waiting_since` by the server and preserved across activity and snapshots. Older servers retain the client-observed start while connected; a cold snapshot without that field can only estimate from its last event time. Regression checks: 189 client tests, Rust workspace tests, builds, Chrome navigation/sheet harness, isolated real-server flow and terminal touch checks pass. Phone checks remain emulated Chrome only; iPhone Safari/PWA native gestures, keyboard and foreground recovery remain unverified.

### G.6 Client: proactive signals — [x] done: session-tabs H.7
Class: implement · Needs: G.4, G.5 · Check: `cd packages/client && npx --yes pnpm@9 test`
Context: Decision 0082; v8 already announces needs-you through an `aria-live` region.
Do: 1. `NeedsYouBanner.svelte` under the tab strip: stacks ("3 need you"), Open, answer buttons when the prompt is hook-confirmed, dismiss, never moves the active tab. 2. Document title count and the PWA badge (`navigator.setAppBadge`, feature-checked). 3. Per-server degraded notice on group header and tabs. 4. Tests for the count, the stack and that none of it changes `activeSession`.
Done-when: tests show the banner appears for a session that is not the active one, the title shows `(2) Termanch` for two, and no code path sets the active session from an event.

### G.7 Client: snapshot first on a tab switch — [x] done: session-tabs H.8
Class: implement · Needs: G.2, G.4 · Check: `cd packages/client && npx --yes pnpm@9 test`; browser check in G.10
Context: Decision 0084. `Terminal.svelte` resets the terminal on `session_attached` and the server repaints.
Do: 1. On `pointerdown` over a tab or card send `peek` with the hash of the last snapshot held for that session. 2. When the snapshot arrives before the attach completes, write it into the terminal dimmed (one wrapper class), keep the per-session last snapshot in memory only (cap 20), then on `session_attached` clear and let the live repaint replace it. 3. No snapshot (herdr or error) means the plain attach as today. 4. Never persist snapshots; never include them in a report.
Done-when: unit tests cover the dim/replace order and the cap; the browser check measures time from touch-down to first painted text and it is under the plain-attach time on the same session.

### G.8 Cache estimate, the `cache` event and the status line forwarder — [>] moved to docs/plans/termanch-roadmap.md as R19 (the cache chip is done)
Class: implement · Needs: G.1 · Check: `cargo test -p termanch-core event && cargo test -p termanch-server claude_hooks`; `cd packages/client && npx --yes pnpm@9 test`
Context: Decisions 0083 and 0079, fact 0031, guardrail `user-settings-are-wrapped-not-replaced`. `claude_hooks.rs` has `connect`/`disconnect`/`merge`/`remove` for hooks and `events.rs::run_hook` forwards stdin to the socket.
Do: 1. `EventKind::Cache {expires_at, ttl, warm, hit_ratio}` in core (unknown-kind rule applies), adapter `claude-statusline` mapping `prompt_cache`, sanitiser keeps only those numbers. 2. `--hook statusline`: reads the JSON, forwards `prompt_cache` only, then runs the user's original command (read from a state file written at Connect) with the same stdin and prints its output unchanged; the whole forward is capped at 2 s and never fails. 3. `connect` wraps an existing `statusLine` (preview shows both), `disconnect` restores the original bytes. 4. Client: `lib/cache.ts` (remaining = exact `expires_at` or estimate TTL minus time since `last_response_at`, TTL setting 5 min or 1 h), a chip on idle agent cards and tabs ("about 3 min" vs "3 min"), and the Keep warm button (one tap, configured reply via `reply`). 5. Tests: wrap and restore with an existing status line and with none, forwarded fields exactly `prompt_cache`, estimate versus exact.
Done-when: tests show the original status line command still receives the same stdin and its output is unchanged, Disconnect restores the original file bytes, a forwarded JSON with a model name and a path forwards neither, and the chip says "about" only for an estimate.

### G.9 Session actions: rename, kill, copy — [x] done: session-tabs H.4
Class: implement · Needs: G.4 · Check: `cargo test -p termanch-server session_actions && cd packages/client && npx --yes pnpm@9 test`
Context: `kill-session-needs-confirmation`. The protocol has no `close_session` or `rename` yet; `SessionBackend` has `create`, `list`, `attach`, `capture`, `send_text`.
Do: 1. `ClientMessage::CloseSession {session}` and `RenameSession {session, name}`; `SessionBackend::kill` and `rename` (tmux `kill-session`, `rename-session`; unsupported managers return an error shown as a toast). 2. Client long-press menu on tabs and cards: Rename, Kill (a confirmation naming the session and its server), Copy name. 3. Audit log entries without content. 4. Tests with a real tmux and the confirmation flow.
Done-when: a real tmux session is renamed and killed through the handlers, the kill needs the confirmation in the client test, and herdr returns the unsupported error.

### G.10 End-to-end, phone check and the docs — [>] moved to docs/plans/termanch-roadmap.md as R03
Class: review · Needs: G.1, G.2, G.3, G.4, G.5, G.6, G.7, G.8, G.9 · Check: `node e2e/run.mjs && node e2e/touch.mjs && node e2e/cards.mjs`
Context: The owner tests on an iPhone; `docs/skills/mobile-ui-device-check.md` has the checklist.
Do: 1. Browser e2e with two real servers (two server processes): both connect with no click, a session on each shows as a tab, a switch shows a snapshot before the live repaint, a needs-you event on the inactive one shows the banner and the count and does not change the active tab. 2. Update README (navigation, views, Connect also wraps the status line) and mark the steps. 3. List what the owner must check on the phone: tab strip scroll, sheet drag and keyboard, long-press menu, banner, badge.
Done-when: the three scripts pass in CI; the owner has the phone checklist and the plan marks which items are verified only in emulated Chrome.

## Open questions for the owner (recommended default first)

1. Should "Keep warm" be sent to the agent as a one-word reply (`continue`) or a configurable text? Recommended: configurable, default empty so it only appears once the owner sets it.
2. Should Paused servers still count in the tab strip with their last known sessions, greyed? Recommended: no, hide them and show the server as Paused in Servers.
