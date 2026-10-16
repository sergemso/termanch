# Termenbox Plan: the UX programme (decision-first Home, act in place, tiered session view, reports, desktop workspace)

Written 2026-10-16 from the roadmap interview. Decisions 0100-0107 (all active) and guardrails `ux-acceptance-targets`, `a-phone-check-names-its-platform`. Replaces decision 0088, amends 0079 and 0090. Builds on the finished status redesign (`docs/plans/agent-status-redesign.md`, decisions 0095-0097) and replaces roadmap steps R20 (card design pass) and, in part, R13 (inbox view), R45 (on-server part) and R53 (dictation, folded into U.8). This file alone is enough for a cold session. It is the main line of work: only R02, R03, R08 and R36 from `docs/plans/termenbox-roadmap.md` stay ahead of it.

## Cold start

Repository: Rust server `packages/server/src` (`events.rs` hub, `agentwatch.rs` scan and screen watchers, `adapters.rs`, `sessions.rs`, `rtc.rs`, `websocket.rs`, `control.rs`, `claude_hooks.rs`, `main.rs`), shared wire types `packages/core/src/{protocol,events}.rs` mirrored by hand in `packages/client/src/lib/protocol.ts`, Svelte 5 client `packages/client/src` (`App.svelte`, `AppShell.svelte`, `NavigationBar.svelte`, `TabStrip.svelte`, `SessionSheet.svelte`, `SessionCard.svelte`, `NeedsYouBanner.svelte`, `InboxSheet.svelte`, `QuickReply.svelte`, `KeyRow.svelte`, `lib/agents.ts`, `lib/inbox.ts`, `lib/agentIcons.ts`), client e2e in `packages/client/e2e` (Playwright via `run.mjs`, `cards.mjs`, `navigation.ts`). Knowledge base in `docs/{facts,decisions,guardrails,skills}`; read `CLAUDE.md` first, then decisions 0100-0107. Tests: `cargo test --workspace`; `cd packages/client && npx --yes pnpm@9 test`. One squashed pull request per step from its own branch off master, green CI, merge only on the owner's "merge" (`changes-land-as-one-squashed-pull-request`, `no-commits-on-the-default-branch`); commit subject `type(scope): ...` with a one-word scope. Constraints: 512 MB RAM, 1 vCPU, no paid services, secrets never logged, builds only in CI, agent text is untrusted and never in notifications (`notifications-carry-no-agent-text`). The owner tests on an iPhone; Android has never had a real-device check (fact 0039), so label every phone check by platform (`a-phone-check-names-its-platform`) and never call an emulator a phone. Never touch the owner's own `termenbox.service`. Plans are tracked in GitHub issues (0049); the tracker answer is in `tracker-writes-follow-the-answer`.

## Goal

A zero-friction product where the user never has to know where anything is: the app opens on what needs them, they decide in place (choose, type, dictate) and rarely need the terminal, yet the terminal is first-class and super-convenient when they want it (draft decision 0109, which supersedes 0102 once accepted). Skins are themeable through tokens (draft decision 0110). Phone is designed as a phone (bottom bar, thumb reach), desktop as a desktop (three panes, palette, shortcuts). Reporting covers a live board, a timeline and digest, usage and cost, and server health. Targets (guardrail `ux-acceptance-targets`): push to sent answer in at most 2 taps; every agent's state on one screen at 0 taps after cold open; any session in 1 tap from Home; first usable paint under 1.5 s on a mid-range phone over 4G; a device check per screen.

## Design in one place (from 0100-0107)

- Destinations: Home, Sessions, Activity, Settings. Phone: bottom bar and full-height session sheet. Desktop: sidebar, main pane, optional right pane (terminal or second session), palette Ctrl/Cmd+K.
- Home: Needs you queue (needs_input, failed, finished_unseen; oldest wait first) plus fleet summary plus Continue card. Queue changes never move under a finger.
- Session view tiers: T1 hooks and transcript (Claude now, Codex after R21), T2 per-agent screen profile, T3 generic. Every agent with an icon gets at least T3, plus T2 for the priority list set in U.3.
- Decision card: plain-terms context, large option buttons, free-text composer with dictation; no standing rules. Escalation ladder with a deep-link push that carries no agent text.
- Reports stored on each server, metadata only, bounded; free on-server; cloud archive and cross-server retention stay Pro.
- Hook offer: one inline card per agent, Enable / Not now / Never; "Not now" re-offers only after a manual terminal answer or 14 days.

Legend: `[ ]` pending, `[~]` in progress, `[x]` done, `[!]` blocked, `[>]` moved.

## Steps

### U.1 Design spike: three directions, owner picks one — [ ]
Class: plan · Needs: none · Check: `test -s docs/plans/assets/ux/DIRECTION.md`
Context: Decision 0107. The client is Tailwind v4 plus shadcn-svelte (0069). There is no `docs/plans/assets/` directory yet; create `docs/plans/assets/ux/`. The owner tests on an iPhone, so prototypes must open there (a served static page or preview URL).
Do: 1. Build 2-3 full-fidelity directions as clickable static prototypes (plain HTML/CSS/JS or a throwaway Svelte page, not wired to the real server) for: Home with a needs-you queue and fleet summary, a decision card (context, option buttons, composer), the session view (T1 and T3 variants), and one report (fleet board or timeline). 2. Each at 390 px and a desktop width (three panes), light and dark, with realistic data: 3 servers, 12 sessions, long task titles, a failed item, an empty state. 3. Save screenshots and prototype sources under `docs/plans/assets/ux/<direction>/`. 4. Ask the owner to open them on the iPhone and pick one; write the pick and the reasons in `docs/plans/assets/ux/DIRECTION.md` with the date.
Done-when: `docs/plans/assets/ux/DIRECTION.md` names one direction, lists what to keep from the others, and the screenshots for every screen above exist for that direction.

### U.2 Codify the design system — [ ]
Class: implement · Needs: U.1 · Check: `cd packages/client && npx --yes pnpm@9 test`
Context: The chosen direction in `docs/plans/assets/ux/DIRECTION.md`. Styles live in `packages/client/src/app.css` and Tailwind; shadcn-svelte components per decision 0069.
Do: 1. Express the direction as design tokens (colour, type scale, spacing, radius, elevation, motion durations, haptics rules) in `app.css` plus a short `docs/plans/assets/ux/TOKENS.md`; components read only tokens, at least three skins ship (dark default, light, one more) and Settings lets the user choose or follow the system (draft decision 0110). 2. Build the small component set the screens share: status chip, agent badge (reuse `AgentIcon.svelte`), decision card shell, option button, composer, queue item, chart frame, empty state. 3. Light and dark, `prefers-reduced-motion` respected, text not conveyed by colour alone. 4. A component gallery page for e2e (`packages/client/e2e/gallery.html`) rendering every component in both themes.
Done-when: unit tests render each component; the gallery loads in the e2e harness with no console error and screenshots exist for light and dark at 390 px.

### U.3 Measure which agents expose what; set the T2 priority list — [ ] ‖
Class: explore · Needs: none · Check: `grep -q 'last-verified: 2026-1' docs/facts/0038-detected-agents-and-what-each-exposes.md && grep -qi 'priority' docs/facts/0038-detected-agents-and-what-each-exposes.md`
Context: Fact 0038 says only Claude Code has a verified surface; the client has icons for claude, codex, copilot, opencode, kilo, gemini, aider, cursor-agent, amp, goose, qwen (`packages/client/src/lib/agentIcons.ts`). Use a throwaway tmux (`tmux -L scratch`), never the owner's sessions; install only agents available without payment, and record the ones that cannot be installed as unmeasured.
Do: 1. For each installable agent, record version, whether it has hooks, a notify program, a log or transcript file, or a JSON mode; and capture screens for idle, working, a permission or choice prompt, a free-text question, finished, into `packages/server/testdata/screens/<agent>-*.txt`. 2. Update fact 0038 with the table and versions. 3. Add a "T2 priority" list to fact 0038: Codex first, then the agents the owner uses (ask the owner), then the rest by how often their prompts can be told apart.
Done-when: fact 0038 has a row with measured or "not installable" for each of the 11 agents, a T2 priority list, and a current `last-verified` date.

### U.4 App shell: bottom bar, sidebar, palette, four destinations — [ ]
Class: implement · Needs: U.2 · Check: `cd packages/client && npx --yes pnpm@9 test && node e2e/run.mjs`
Context: Decision 0101. Today `AppShell.svelte` and `NavigationBar.svelte` host the tab strip and sheet (decision 0082), which stay as the in-session switcher. Guardrails `ui-never-moves-under-the-finger`, `soft-keyboard-never-hides-input`. The e2e harness has `shell.html`/`shell.ts`/`navigation.ts`.
Do: 1. Add a router for Home, Sessions, Activity, Settings (Activity and Home may start as placeholders). 2. Phone width: bottom bar with the four destinations, safe-area aware, hidden while the soft keyboard is open inside a session; session opens as a full-height sheet with swipe-back. 3. Desktop width (>= 1024 px): sidebar with destinations, servers and sessions with status; main pane; optional right pane toggle. 4. Command palette on Ctrl/Cmd+K: jump to a session, server, destination or action (new session, pause server). 5. Keep `TabStrip.svelte`/`SessionSheet.svelte` working inside a session. 6. Playwright e2e at 390 px and 1280 px covering each destination and the palette.
Done-when: e2e shows all four destinations reachable at both widths, the palette opens a session by name, no control moves when a status update arrives while a touch is down, and the in-session tab switch still works.

### U.5 Home: Needs you queue, fleet summary, Continue — [ ]
Class: implement · Needs: U.4 · Check: `cd packages/client && npx --yes pnpm@9 test && node e2e/cards.mjs`
Context: Decision 0100. Attention items and Activity already live in `packages/client/src/lib/agents.ts` and `lib/inbox.ts`; `InboxSheet.svelte` and `NeedsYouBanner.svelte` are today's surfaces; `SessionCard.svelte` renders cards; `lib/cards.ts` builds them. Resume-last-session logic of the old 0088 is in the start path (search `termenbox_last`/last-session in `App.svelte` and `lib/`).
Do: 1. Home shows, across all servers, queue items ordered needs_input, failed, finished_unseen, oldest wait first, each with agent badge, server, task title, time waiting. 2. Below, a fleet summary grouped by server and agent (working, idle, done counts and a row per session). 3. A Continue card for the last used session, shown when nothing needs a decision; replace the old auto-attach on open. 4. Queue changes are applied only when no touch is down and 2 s after a scroll. 5. `NeedsYouBanner` and `InboxSheet` read from the same items and link to Home. 6. Empty states for no servers, no sessions, all quiet.
Done-when: unit tests cover queue ordering, the 2 s settle rule and the Continue card; the cards e2e shows 20 sessions on Home with 0 taps needed to see every state at 390 px.

### U.6 Session-view framework: T3 view, composer, profile engine — [ ]
Class: implement · Needs: U.2 · Check: `cargo test -p termenbox-server profile && cd packages/client && npx --yes pnpm@9 test`
Context: Decision 0103. Screen watching exists in `packages/server/src/agentwatch.rs` (scan and screen heuristics, prompt matching); agent state is derived in `events.rs`; `QuickReply.svelte` and `KeyRow.svelte` send keys. Wire types in `packages/core/src/{protocol,events}.rs` mirrored in `packages/client/src/lib/protocol.ts`; every enum has a `serde(other)` Unknown so old peers ignore new kinds.
Do: 1. Define the profile format (data files under `packages/server/profiles/<agent>.toml` or similar: how to recognise the agent, prompt and numbered-option patterns, working and idle markers, task-line pattern, and the keys that answer each option) and a loader plus matcher in a new `packages/server/src/profile.rs`; document the schema at the top of that file and in `docs/skills/add-an-agent-profile.md` (replace its "defined in the UX plan" line with the file path). 2. A generic profile (T3) that detects the common prompt shapes (numbered choices, y/n) and a cleaned screen tail (control sequences resolved by `capture-pane`, 30 lines, sanitised and capped, scrubbed). 3. New wire messages for the session view (cleaned tail, parsed prompt with options, tier in use) additive and ignorable by old clients, on the status channel (0096). 4. Client session view: header (agent, task, time, state), parsed decision area, cleaned tail, composer (type, quick replies), a visible tier label, and a one-tap button to the full terminal. 5. Parsed options send only the keys the profile lists; no free key synthesis.
Done-when: server tests prove a profile cannot emit keys outside its listed options, a screen where nothing should match yields no prompt, and untrusted text is sanitised; client tests render the T3 view for an agent with no profile; an old client against the new server and the reverse both still work.

### U.7 T2 profiles for the priority agents — [ ]
Class: implement · Needs: U.3, U.6 · Check: `cargo test -p termenbox-server profile`
Context: Procedure `docs/skills/add-an-agent-profile.md`; priority list and recorded screens from U.3 (`packages/server/testdata/screens/`).
Do: For each agent on the priority list, in order: write its profile, tests over the recorded screens (idle, working, prompt, free-text question, finished, a non-matching screen), and update fact 0038. One agent per pull request if that keeps them reviewable.
Done-when: every agent on the priority list has a profile whose tests pass over its recorded screens; the session view shows "T2" for those agents; agents not on the list still show T3.

### U.8 Decision card: context, options, composer, dictation — [ ]
Class: implement · Needs: U.5, U.6 · Check: `cd packages/client && npx --yes pnpm@9 test && node e2e/cards.mjs`
Context: Decisions 0102 and 0104; roadmap step R53 (voice input; its spike on the iPhone comes first: `docs/plans/roadmap/R53.md`); guardrails `ui-never-moves-under-the-finger`, `notifications-carry-no-agent-text`, `soft-keyboard-never-hides-input`. Today answers and replies exist in `QuickReply.svelte` and `SessionCard.svelte` (v8 K.2-K.5).
Do: 1. The decision card used on Home, in the inbox and in the session view: plain-terms question, the task and wait time, large option buttons from the parsed prompt (0103), a free-text field that sends text then Enter, and a visible tier label. 2. T1 context where available: command, file or diff summary from hook data (`claude_hooks.rs`, events `tool` and `prompt`), rendered as untrusted text; no standing rules, no batch approve. 3. Answer in place: tapping an option sends exactly the keys of that option and the card resolves when the server clears Attention, not before. 4. Composer dictation per R53: first run its spike on the owner's iPhone and Android (does the keyboard's own dictation reach the input, does `webkitSpeechRecognition` run in the installed PWA); if the keyboard path suffices, show a mic hint that focuses the composer; otherwise implement as R53 describes. No audio leaves the device to our servers. 5. Mark R53 as folded into this step in `docs/plans/roadmap/R53.md`.
Done-when: Playwright shows a needs_input item answered from Home with one tap on an option, and a typed reply sent from the card, without opening the terminal; the card does not resolve until Attention clears; the owner confirms dictation on iPhone and the result is recorded in the PR with its platform label.

### U.9 Claude Code T1 view: timeline from the transcript — [ ]
Class: implement · Needs: U.6 · Check: `cargo test -p termenbox-server transcript && cd packages/client && npx --yes pnpm@9 test`
Context: Fact 0029: every Claude hook event carries `transcript_path` and `session_id`; `Stop` carries `last_assistant_message`. Hooks are opt-in (0079, 0106). Transcript content is untrusted and may hold secrets.
Do: 1. Server: a bounded, size-capped incremental reader for the transcript file a hook named (never an arbitrary path: only paths under the invoking user's Claude config directory), producing timeline entries (prompt, tool step with tool name and one-line summary, plan progress, last assistant message, changed file names) within the memory budget. 2. Wire messages and a client timeline in the session view above the composer, shown for T1 sessions; secrets scrubbed before sending; nothing from the transcript audit-logged. 3. Without hooks the view stays at T2 or T3.
Done-when: tests prove a path outside the allowed directory is refused, a 50 MB transcript is read with bounded memory, a token in a tool line is scrubbed, and the client renders the timeline for a recorded transcript fixture.

### U.10 Hook offer card and enable button — [ ]
Class: implement · Needs: U.5 · Check: `cargo test -p termenbox-server connect && cd packages/client && npx --yes pnpm@9 test`
Context: Decisions 0079 and 0106; guardrails `user-settings-are-wrapped-not-replaced`, `host-changes-are-journaled`. Today connecting is a command (`--connect-claude --yes`, see `packages/server/src/claude_hooks.rs` and `control.rs`).
Do: 1. A server control request that previews the exact settings change and applies or removes it (reusing `claude_hooks.rs`), with the backup and journal behaviour already there. 2. Home card on first detection of an agent with a verified hook surface: preview, Enable, Not now, Never; stored per agent per server. 3. Anti-nag rule: "Not now" re-offers only after the user answered a prompt by hand in the terminal or after 14 days; "Never" permanent, reversible in Settings. 4. Settings shows the hook state per agent with enable and remove.
Done-when: tests cover the re-offer rule (a day count and a manual-answer trigger), that Never stops offers, and that the preview equals what is written; e2e enables hooks from Home and the session reaches T1.

### U.11 Escalation ladder — [ ]
Class: implement · Needs: U.8 · Check: `cargo test -p termenbox-server push && cd packages/client && npx --yes pnpm@9 test`
Context: Decision 0104. Push exists (A.6 of the status redesign; `packages/server/src` push module, `packages/client/src/lib/push.ts`); the payload must carry no agent text. Answers anywhere clear Attention (0095).
Do: 1. Deep link in the push opens Home scrolled to that decision card, behind the app lock if one is set. 2. Server ladder: after the first push, re-notify after a user-set wait (default 10 minutes), then at growing intervals up to a cap; stops when Attention clears on any device. 3. Settings: wait length, quiet hours, per-agent mute; in-app inbox, banner and tab-title count remain the fallback when push is not installed. 4. Payload test: no marker text from title, prompt or options.
Done-when: server tests prove the ladder timing with a fake clock, that an answer on one device stops it, that quiet hours and mutes suppress pushes, and that a marker in the agent text never reaches the fake push endpoint; Playwright proves the deep link lands on the card (2 taps from push to sent answer).

### U.12 History store, Activity timeline and daily digest — [ ]
Class: implement · Needs: U.4 · Check: `cargo test -p termenbox-server history && cd packages/client && npx --yes pnpm@9 test`
Context: Decision 0105. Attention and Activity transitions are in `events.rs`. 512 MB, 1 vCPU; memory only is the rule for secrets, but history needs durable storage: a small file store under the server's state directory.
Do: 1. Server store of metadata only (session, agent, task title capped and scrubbed, started and ended times, outcome, time blocked on the user), bounded by size and age (defaults 90 days or 20 MB, configurable), append-only with compaction. 2. Query messages for day and week ranges. 3. Activity destination: a timeline per day, a daily digest (tasks finished, failures, time agents waited on the user), charts per the design system. 4. Deletion of the history from Settings; the privacy notice (R08) says what is stored.
Done-when: tests prove the store stays within its bounds, holds no prompt or terminal text, survives a restart, and answers a week query; the client shows a timeline and digest from a fixture; the resource gate (`e2e` throughput and RSS checks) still passes.

### U.13 Usage and cost view — [ ]
Class: implement · Needs: U.12 · Check: `cd packages/client && npx --yes pnpm@9 test`
Context: Decisions 0083 (status-line forwarder, cache-expiry estimate) and 0105; usage on the device stays on the device (0073, `usage-stays-on-device`) and is a different thing from agent usage shown here. Data exists only where an agent exposes it (Claude first; roadmap R19 adds the forwarder).
Do: 1. Collect tokens, spend and rate-limit windows from hooks and the forwarder into the history store (metadata, counts). 2. Activity shows usage and cost per agent and project with cache-expiry and window indicators. 3. Where an agent exposes nothing, show that plainly, not zeros. 4. If R19 is not done, do it first or limit this step to what hooks provide.
Done-when: tests show the view from a fixture with data and the honest "not available" state; nothing readable beyond counts and names is stored.

### U.14 Server health collection and view — [ ] ‖
Class: implement · Needs: U.4 · Check: `cargo test -p termenbox-server health && cd packages/client && npx --yes pnpm@9 test`
Context: Decision 0105; `resource-constraints`. Read `/proc` or the existing server metrics; no new heavy dependency.
Do: 1. Sample CPU, RAM, disk and the connection round-trip time on a slow interval (every 10 s, ring of 6 hours). 2. Activity shows server health per server with a dot on Home's fleet rows when a server is unhealthy. 3. Cost of sampling measured and noted in the PR.
Done-when: tests show the ring bound and a threshold producing the dot; sampling uses under 1% CPU on the dev VPS in the PR's measurement.

### U.15 Desktop workspace: panes and shortcuts — [ ]
Class: implement · Needs: U.5, U.8 · Check: `cd packages/client && npx --yes pnpm@9 test && node e2e/run.mjs`
Context: Decision 0101 (three panes, palette) and U.4's shell.
Do: 1. Right pane showing the live terminal or a second session view next to the selected one; resizable, remembered per device. 2. Shortcuts: approve and deny the focused decision, next needs-you, focus composer, toggle panes, with a visible shortcut sheet and no clash with terminal input when the terminal is focused. 3. Same components as phone; verify at 1280 and 1920 px.
Done-when: e2e shows structured view and terminal side by side with live output, a shortcut answering a decision, and no key leaking into the terminal when the composer is focused.

### U.16 Real-device gate and the free gate — [ ]
Class: review · Needs: U.4, U.5, U.7, U.8, U.9, U.10, U.11, U.12, U.13, U.14, U.15 · Check: `test -s docs/plans/assets/ux/device-pass.md`
Context: Guardrails `ux-acceptance-targets`, `a-phone-check-names-its-platform`; procedure `docs/skills/mobile-ui-device-check.md`; roadmap R03 (real-iPhone checklist) and R40 (the free gate check).
Do: 1. The owner runs the device checklist on a real iPhone (Safari and installed PWA) and a real Android phone (Chrome and installed PWA); record each screen with its platform label and the tap counts in `docs/plans/assets/ux/device-pass.md`. 2. Run the throttled first-paint check. 3. Update `docs/plans/roadmap/R40.md` so the free gate requires this pass, and set R13, R20 and R45's on-server part to done or moved in the roadmap with `python3 docs/plans/roadmap/rank.py`. 4. A reviewer agent checks the diff against decisions 0100-0107 and the two guardrails.
Done-when: `device-pass.md` has every screen with a real-device result for iPhone and Android (or an explicit "Android: emulated only" with the owner's recorded decision to accept it), the first-paint number is under 1.5 s, and R40 cites this file.
