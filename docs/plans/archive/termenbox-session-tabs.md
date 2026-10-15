> Archived 2026-10-14. Every open step was moved into `docs/plans/termenbox-roadmap.md` (see the `[>]` markers); this file is history.

# Termenbox Plan: session tabs, parallel-agent cockpit and compact mobile chrome (implemented in one branch; decision 0085 is a draft)

Builds on `termenbox-v9-navigation.md` (G.*), `termenbox-v8-session-cards.md` (K.*) and `termenbox-v6-agent-events.md`. Pulls in the pending UI steps listed under "Moved in". Step letters are H. Nothing here is decided until the owner accepts it; contradictions found while merging are listed with their resolution. Guardrails: `ui-never-moves-under-the-finger`, `kill-session-needs-confirmation`, `soft-keyboard-never-hides-input`, `connections-warn-never-drop`. One squashed PR per step from its own branch off master, green CI, merge only on the owner's "merge". The owner tests on an iPhone; emulated Chrome is never claimed as a phone check.

## Goal

Run many agents in parallel from a phone: see every agent on every server at a glance (which one, what it is doing, in which repo), be told when one needs you without being moved, answer or open it in one touch, and still have most of the screen for the terminal.

## Feedback this plan answers

Stray "detach…" sessions; no agent icon on tabs; Close does nothing; tapping a tab should show the multiplexer's windows with process icons and per-window close; Detach and Close must be separate; tab shows the working directory instead of a name; more well-known agent icons in full colour; herdr is a multiplexer, not an agent; bottom chrome makes the terminal unusable on an iPhone; tmux bundling considered.

## Findings

- The "detach" prefix is not UI: `packages/server/src/e2e.rs:518` creates `detach<8 hex>` sessions and never kills them (`tmux ls` shows `detach2793d616`, `detachead36b87`).
- Close: `SessionActions.svelte` "Close" only dismisses the dialog. No kill message, no `SessionBackend::kill`. Client `Detach` only stops streaming.
- Agent kind is known (`SessionAgent.agent`, `agentwatch.rs::scan_tmux_once`, `adapters::agent_name`: claude/codex/herdr) but `TabStrip.svelte:95` shows only the state glyph. Server never calls `list-windows`; `pane_current_command`/`pane_current_path` never reach the client.
- Fixed chrome on a phone ≈ 235 px: topbar 56 + sheet peek 96 + status bar ~30 + key row ~53.

## Moved in from pending plans

| From | Step | Why it belongs here |
|---|---|---|
| v9 | G.6 proactive signals (banner, title count, app badge) | "stay notified"; shares the space budget |
| v9 | G.7 snapshot first on tab switch | tab/window switching; must follow the representative window |
| v9 | G.8 cache chip and Keep warm (UI part; statusline forwarder stays in v9) | agent-state density on tabs and cards |
| v9 | G.9 kill (rename and copy dropped by the owner) | overlaps this plan's Close; merged into H.4 |
| v3 | U.3 `close_session`, `multiplexer` and `prefix` in `auth_ok` | same server work as H.4/H.6; U.3 is otherwise superseded |
| v3 | U.6 key row profiles and Prefix key | key row is being compacted (H.9); window ops move to the dropdown |
| v2 | A.3 session templates (new Claude Code/Codex/shell in a chosen directory) | starting parallel agents is the core flow |
| v8 | K.6 / v7 O.3 inbox and Web Push | only the store interface is prepared here (H.7); the push server stays in v7 |

Already done on master (re-checked in the code, 2026-10-13), so not in this plan: v2 A.1 (one-finger scroll, pinch font `lib/terminal/pinch.ts`, long-press select `lib/selection.ts`, paste `lib/clipboard.ts`, transport and RTT in the `Terminal.svelte` status line) and v2 A.2 (`manifest.webmanifest`, `sw.js`, install prompt and iOS hint in `MenuSheet.svelte`, reconnect on visibility/online in `connection.ts`); also v9 G.1–G.5 and v8 K.2–K.5 (cards, frozen order, quick replies, sheet and views), (the existing "Copy name" button is removed in H.4). What is left of A.1/A.2 is only the owner's phone check of standalone height. Still open and verified missing: close/kill (no protocol message), the peek send from the client (the `peek`/`snapshot` types exist in `protocol.ts` but nothing sends `peek`), banner/badge, cache chip, Prefix key and key profiles, the new-session flow (today three `prompt()` dialogs in `App.svelte:239`, no templates or directory), cwd/windows/agent icons.

Superseded, not moved: U.1 (Tailwind/shadcn; G.4/G.5 shipped without it and the bundle gate is 2 MB), U.4 and U.5 (done as G.3/G.4), T.2 sponsor badge (header space; revisit after H.9), D.4 and the S/C/N phases (not UI-for-agents).

## Contradictions found and how they are resolved (win-win)

1. **Path as tab label vs. several agents in one repo.** Three agents in `~/projects/termenbox` would be three identical tabs. Resolution: the label is the path tail; when two tabs would read the same, the session name (or the agent icon plus a short index) is appended as a second line. Tabs have no rename and no copy-name (owner decision), so the path tail plus that disambiguation is the whole label; the existing "Copy name" button in `SessionActions.svelte` is removed.
2. **Label changes vs. `ui-never-moves-under-the-finger`.** A cwd or representative-window change would rewrite a tab under a finger. Resolution: label/icon updates go through the same `FrozenOrder` rule (deferred while touching, a sheet is open, or 2 s after a scroll).
3. **Tab shows agent icon + state + needs-you dot + cache chip + path: too dense, and colour icons clash with colour-coded state.** Resolution: the agent icon is full colour; the state is a corner badge on the icon with a distinct shape per state (not colour alone, plus the word for assistive tech); the needs-you dot is merged into that badge; the cache chip lives on cards and the dropdown, and on a tab only as a thin expiring ring in the last minute.
4. **Window shown on the tab vs. window you land in.** Icon and path come from the representative window, but attach lands in tmux's active window, so the tab would promise an agent and show a shell. Resolution: the peek snapshot and the attach both target the representative window (`select-window` before attach) only when no other client is attached to the session; if another client is attached (the user's desktop), the representative window falls back to the active one so we never change a desktop view. Open question 1 asks the owner.
5. **Tab strip has no ✕ (v9) vs. close buttons wanted.** Resolution: no ✕ on tabs; Detach and Close live in the dropdown header and the long-press menu; ✕ per window is inside the dropdown. Close and closing a window with a non-shell foreground process use the existing confirmation (`kill-session-needs-confirmation`); Detach never asks.
6. **Persistent sessions-sheet peek (96 px) vs. space.** The top bar already has the Sessions button with the needs-you count, so the permanent peek is redundant on a phone. Resolution: on phones the sheet is closed by default and opened by that button; glanceability comes from the banner (H.7) and tabs. Wide screens keep the docked sidebar. Decision 0082 says "peek, half, full": captured as an amendment.
7. **Always-visible status bar (RTT, transport, font, bell) vs. space.** Resolution: transport/RTT become the server dot in the top bar (tap = details); font size, bell and keyboard toggle move to ☰ and a pinch gesture; reclaimed row removed.
8. **Banner for needs-you vs. space.** It exists only while something needs you, one line, replaces nothing, never switches tab; with the soft keyboard open it collapses into the tab badge (`soft-keyboard-never-hides-input`).
9. **Herdr as agent (G.1 docs, P.5, grouping by agent, fact 0029) vs. "herdr is not an agent".** Resolution: herdr is a multiplexer backend; panes inside it can run agents. Remove it from `agent_name`; the view's agent group has no "herdr" bucket (a herdr session is grouped by its detected inner agent, else "shell"). Herdr has no capture/send/kill, so backends declare capabilities (`windows`, `kill`, `peek`, `send`) and the UI hides actions a backend lacks instead of showing error toasts.
10. **Prefix key combos (U.6) vs. window dropdown.** Both offered next/prev/new/close window. Resolution: window operations live in the dropdown; the Prefix key stays as one sticky key for everything else and the combo menu keeps only splits, copy mode and detach.
11. **Cwd per session makes a new grouping possible.** Add "Project" (repo root or cwd) as a group-by in `lib/views.ts` so parallel agents in one repo sit together; no conflict, win for organizing.

## Representative window

One server-side function in the existing scan (`list-panes -a -F` with `window_index`, `window_activity`, `window_active`, `pane_current_command`, `pane_current_path`), sent per session as `{window, agent?, command, cwd}`:
1. the agent window most recently active (`window_activity`, ties → leftmost);
2. else tmux's active window;
3. else window 0.
Icon, path, peek and (when allowed, contradiction 4) attach target use the same window. Updates are emitted only when `{window, agent, cwd}` changes.

## Steps

### H.1 Stop leaking test sessions — [x]
Class: implement · Needs: none · Check: `cargo test -p termenbox-server e2e` then `tmux ls` shows no `detach…`
Do: kill the session at the end of `detach_preserves_the_connection_and_session` (`e2e.rs` ~l.516) with a drop-guard so it also runs on failure; with approval, kill the two leftover sessions.
Done-when: running the e2e twice leaves no new sessions.

### H.2 Backend capabilities, herdr is not an agent — [x]
Class: implement · Needs: none · Check: `cargo test --workspace && cd packages/client && npx --yes pnpm@9 test`
Do: 1. Drop `herdr` from `adapters::agent_name` and the `set_agent(…, "herdr")` calls in `poll_herdr_once`. 2. `auth_ok`/session info carries capabilities per manager and `multiplexer` and `prefix` (U.3 part). 3. Client hides actions a backend lacks. 4. Fix grouping in `lib/views.ts:52` and docs wording (decision 0059, fact 0029, P.5 note); run `capture`.
Done-when: a herdr session never shows an agent icon of its own, and Close/Peek are hidden for it.

### H.3 tmux control mode: representative window, cwd and windows on the wire — [x]
Class: implement · Needs: H.2 · Check: `cargo test -p termenbox-core -p termenbox-server control`
Context: the scan (`agentwatch.rs::scan_tmux_once`, `list-panes -a` on a timer) is replaced for tmux by control mode (owner decision). `tmux -V` here is 3.6; control-mode subscriptions need tmux ≥ 3.2.
Do: 1. New `control.rs`: per tmux session one long-lived `tmux -C attach -t =name` through `Runner` (so host mode keeps working), started with the client flags that suppress pane output and ignore its size (`no-output`, `ignore-size`; verify the names against the pinned tmux), registered as `-B` subscriptions for all panes (`refresh-client -B 'termenbox:%*:#{window_index}|#{window_active}|#{window_activity}|#{pane_current_command}|#{pane_current_path}'`), plus the notifications `%window-add`, `%window-close`, `%window-renamed`, `%session-window-changed`, `%sessions-changed`, `%exit`. 2. A parsed in-memory model per session (windows and their command/path/active/activity) feeds the representative-window rule, `SessionAgentState` (`window`, `command`, `cwd`, serde default, mirrored in `protocol.ts`) and the H.6 window list; emit only when `{window, agent, cwd}` changes. 3. Octal-escaped control output is decoded and every name/path treated as untrusted text. 4. Reconnect the control client with backoff when tmux restarts; drop it when the session goes. 5. Fallback: tmux < 3.2, or control start failing, keeps the old scan; herdr keeps `poll_herdr_once`. The failure is visible, not silent: the startup `tmux -V` check (`backend.rs`) parses the version, logs once, reports `control_mode: false` and the reason in `auth_ok`, and the client shows a one-line notice in the server's status ("tmux 3.0a: live window updates need 3.2"); the installer prints the same warning when the package manager provides an older tmux. 6. Control clients are excluded from "is another client attached" (`list-clients -F '#{client_control_mode}'`), needed by contradiction 4. 7. `Peek` targets the representative window.
Done-when: tests with a recorded control-mode transcript and a real tmux cover agent-wins-by-activity, tie → leftmost, no agent → active window, window add/close/rename updating the model, no event when nothing changed, fallback on an old version, and no pane text in logs; one session adds one `tmux -C` process and the server stays inside the 512 MB limit with 20 sessions.

### H.4 Detach and Close (merges G.9 kill and U.3) — [x]
Class: implement · Needs: H.2 · Check: `cargo test -p termenbox-server session_actions && cd packages/client && npx --yes pnpm@9 test`
Do: 1. `CloseSession {session}`; `SessionBackend::kill` (tmux `kill-session -t =name`, `valid_name`); handler in `sessions.rs` (~l.228) replies with a fresh `Sessions` list; audit entry without content. 2. `SessionActions.svelte` (long-press) and the dropdown header: **Detach** (tab closes, stream stops via `ClientMessage::Detach`, session stays in the sheet, no confirmation), **Close session** (confirmation naming session and server); the "Copy name" button is removed and the old dismiss button becomes Cancel. 3. Tests with real tmux and the confirmation flow.
Done-when: a real session is killed through the handler, kill needs the confirmation, detach leaves it listed.

### H.5 Agent icons in full colour — [x]
Class: implement · Needs: H.2 · Check: `cd packages/client && npx --yes pnpm@9 test && npx --yes pnpm@9 check:bundle`
Do: extend `agent_name`: claude, codex, copilot, opencode, kilo, gemini, aider, cursor-agent, amp, goose, qwen (confirm at implementation). `lib/agentIcons.ts` maps name → bundled colour SVG (in the repo, no remote fetch; where a logo's terms are unclear use a coloured letter badge) and common programs (bash/zsh, mc, lazygit, vim/nvim, htop, ssh, node, python) → icons; generic fallback. State is the corner badge from contradiction 3.
Done-when: tests map each known command to an icon and an unknown one to the fallback; bundle gate still passes.

### H.6 Tab = icon + path; windows dropdown — [x]
Class: implement · Needs: H.3, H.4, H.5 · Check: `cd packages/client && npx --yes pnpm@9 test`; `e2e/cards.mjs` extended
Do: 1. `TabStrip.svelte`/`lib/tabs.ts`: icon with state badge + shortened path (last 1–2 segments, `~` for home, full path as tooltip), duplicate disambiguation (contradiction 1), updates through `FrozenOrder`. 2. `ClientMessage::Windows {session}` → `WindowList {session, windows:[{index,name,command,path,active,agent?}]}` (served from the H.3 control-mode model and pushed on `%window-add/close/renamed`, so the open dropdown stays live); `SelectWindow`, `CloseWindow {session,index}` (`kill-window`; confirmation when the foreground process is not a shell; closing the last window warns it ends the session). 3. `WindowMenu.svelte`, opened by tapping the active tab: header with session name, Detach, Close session; rows with icon, command, path, active marker; tap selects, ✕ closes. 44 px targets, keyboard-safe. 4. Tests incl. escaped window names and paths.
Done-when: tests cover label shortening, duplicate disambiguation, frozen updates, window select/close; e2e shows the dropdown on a fake session with three windows.

### H.7 Proactive signals (G.6) with the inbox interface — [x]
Class: implement · Needs: H.6 · Check: `cd packages/client && npx --yes pnpm@9 test`
Do: as G.6 (`NeedsYouBanner.svelte`, `(2) Termenbox` title, `navigator.setAppBadge`, per-server degraded notice), plus the collapse-with-keyboard rule (contradiction 8) and a small `lib/inbox.ts` store interface the future Web Push inbox (v7 O.3/K.6) will fill. Never sets the active session.
Done-when: as G.6; banner collapses when the keyboard opens; no code path sets the active session from an event.

### H.8 Snapshot first and cache chip (G.7, G.8 UI) — [x]
Class: implement · Needs: H.3, H.6 · Check: `cd packages/client && npx --yes pnpm@9 test`; browser check
Do: G.7 as written, targeting the representative window; the G.8 cache chip and Keep warm on cards and in the dropdown (statusline forwarder and `cache` event stay in v9 G.8; chip shows "about" for estimates).
Done-when: as G.7 and the chip tests of G.8.

### H.9 Compact mobile chrome (U.6 key row) — [x]
Class: implement · Needs: H.6 · Check: `cd packages/client && npx --yes pnpm@9 test`; `e2e/touch.mjs`; owner phone check (also the installed-PWA standalone height, since A.2 already ships)
Do: 1. Sessions sheet closed by default on phones, opened by the top-bar Sessions button, which today toggles peek/half in `App.svelte` (contradiction 6). 2. Remove the status bar row in `Terminal.svelte` (~30 px): move its transport/RTT text (already computed, l.318) to a server dot in the top bar, font size and bell to ☰ (pinch already exists). 3. Single key row: `.k` 40→34 px visible height with 44 px hit areas via padding, row padding 6→3; profiles `shell`/`tmux` and a sticky Prefix key (U.6, combos reduced per contradiction 10). 4. Top bar 56→44 px. Target ≤ ~110 px fixed chrome at 390×844, measured before/after.
Done-when: e2e measures the terminal's share of the viewport before/after with chrome ≤ the target; no control hit area under 44 px; the owner confirms on an iPhone.

### H.10 Start parallel agents: new-session templates (A.3) — [x]
Class: implement · Needs: H.4, H.5 · Check: `cargo test -p termenbox-server && cd packages/client && npx --yes pnpm@9 test`
Do: replace the three `prompt()` dialogs in `App.svelte:239` (server, name, backend) with a New session sheet: templates (Shell, Claude Code, Codex, Copilot, OpenCode, Gemini, custom) plus a directory picker from recent repos; created in the chosen cwd and named by the path tail. Add "Project" as group-by in `lib/views.ts`.
Done-when: a user starts Claude Code in a chosen directory from the phone in under 5 taps and the new tab shows its icon and path.

### H.11 End-to-end and phone checklist — [>] moved to docs/plans/termenbox-roadmap.md as R03
Class: review · Needs: H.1–H.10 · Check: `node e2e/run.mjs && node e2e/touch.mjs && node e2e/cards.mjs`
Do: e2e with two real servers: three sessions with agents in one repo (distinct tabs), Detach vs Close, window ✕, banner without tab change, label frozen during touch; update README; list for the owner what is verified only in emulated Chrome (tab scroll, dropdown, long-press, banner, keyboard, PWA height).

## Status (2026-10-13)

Built in one branch. What is verified and what is not:

- **Server (Rust, 146 + 6 tests, real tmux):** `control.rs` (tmux `-C` per session, change signal only, `list-panes -s` for content, version floor 3.2 with the scan as fallback, tested against a real tmux for window add/rename/close and `cd`), `close_session` / `close_window` / `select_window` / `windows`, `new_session` with `dir` and an agent template (fixed list, absolute directory), representative-window rule, attach lands in it only when no real client is attached, peek targets it, `auth_ok` carries `control_mode`, `tmux_version`, `prefix`; herdr is no longer an agent; 11 known agents; the e2e tests kill their sessions on drop (the two leaked `detach…` sessions were killed).
- **Client (219 unit tests, build, 215 KB gzipped bundle gate):** icon + path tabs with duplicate disambiguation and frozen updates, windows dropdown with per-window ✕ (asks for a running window and for the last one), Detach (closes the tab, keeps the session; reappears while the agent needs you) vs Close (confirmed), needs-you banner (collapses with the keyboard, never switches tab), title count and app badge, peek on touch-down with a dimmed preview until the attach repaint, cache estimate chip, Keep warm (setting, hidden while empty), Prefix key and combos for tmux, key row absorbs keyboard/bell/text size, status bar removed (connection dot in the top bar), sheet closed by default on a phone, Project group-by, New session sheet with templates and directories in use.
- **Browser harness (real Chromium at 390 px, fake servers):** `cards.mjs` and the new `windows.mjs` pass; fixed chrome measured at 90 px (top bar 49 + key row 41) against about 235 px before. `touch.mjs` passes against the real server. `run.mjs` passes everything up to its 10-second throughput step, which times out here with this change and also with the master binary, so it is not caused by this change; CI is the judge.
- **Not verified, owner's phone:** iPhone Safari and installed-PWA behaviour of the dropdown, long-press, banner, preview-before-attach timing, and the soft keyboard with the Prefix key.
- **Deviations from the text above:** control mode replaces the *metadata* polling (windows, directory, command, activity) but not the state scan, which needs output times and screen text; "server dot" tap shows the connection text in a toast; the New session directory field takes a typed or picked path, with no server-side directory browsing; tmux bundling was not started (separate PR, as planned). The `lib/inbox.ts` store interface of H.7 was not built (nothing consumes it until Web Push exists). Backend capabilities are decided by backend kind (tmux can close/peek/list windows, herdr cannot) rather than declared by each manager.

## Open questions for the owner (recommended default first)

1. Land in the representative window on tab switch (select-window before attach) only when no other client is attached? Recommended: yes. Otherwise attach to tmux's active window and drop the agent-window promise.
2. Close a window with a running non-shell process: confirm always, or only for agent windows? Recommended: any non-shell foreground process.
3. Agent list for H.5 (aider, cursor-agent, amp, goose, qwen beyond your list)? Recommended: include; they cost one map entry each.
4. Sessions sheet hidden by default on phones (contradiction 6) and the decision-0082 amendment? Recommended: yes.

## Considerations: bundling tmux / own multiplexer (not part of this plan)

Today the server calls bare `tmux` (`backend.rs` `Runner::wrap`, `agentwatch.rs`, `pty.rs`); Docker installs it in `Dockerfile.base`; native installs use the host package manager (decision 0075, journaled); host mode runs it through `nsenter`.
- **Bundle a static tmux** (ISC licence, ~1–2 MB, musl static with libevent+ncurses, per-arch, pinned): removes the package-manager step and version skew (the format strings used here need a modern tmux). Costs: a release pipeline per arch, security-update duty, terminfo, and in host mode the binary must be extracted to a host path reachable from the `nsenter` namespace. Docker gains little. Resolution order `TERMENBOX_TMUX` → bundled → `PATH`, in `Runner` only.
- **Own multiplexer**: VT emulation, scrollback, windows/panes, a daemon that survives server restarts, copy/paste semantics, and loss of compatibility with existing user tmux sessions. Worth it only if tmux limits bite; `SessionBackend` (decision 0054) and H.2 capabilities allow it later as another backend.
- **Control mode (adopted, H.3)**: structured window/cwd/activity events instead of polling, no own multiplexer needed. It needs tmux ≥ 3.2, which strengthens the case for bundling a pinned tmux; costs one `tmux -C` child per session and a parser for the escaped control output.
- **Recommendation**: bundle a pinned static tmux for native/release installs in a separate PR with its own decision record; do not write a multiplexer now; control mode is already in this plan (H.3) and raises the minimum tmux to 3.2 until the bundle lands.

## Verification

`cargo test --workspace`, `pnpm -r test`, `pnpm -r build`, the three e2e scripts, then the owner's iPhone checklist (`docs/skills/mobile-ui-device-check.md`). Run `capture` afterwards for the herdr, sheet-peek and tab-label decisions.
