> Archived 2026-10-14. Every open step was moved into `docs/plans/termanch-roadmap.md` (see the `[>]` markers); this file is history.

# Termanch Plan: session card UX (DRAFT roadmap, needs owner review)

Decisions: 0061, 0070 (session navigation), 0079. Guardrails: `kill-session-needs-confirmation`, `soft-keyboard-never-hides-input`, `minimum-browser-support`, `connections-warn-never-drop`. Extends v2 step A.3 (session list and templates) with the events of `termanch-v6-agent-events.md` (steps P.*) and shares the inbox of `termanch-v7-output-connectors.md` (step O.3). Step letters are K (free in v1-v5; the draft's U collided with v3). Nothing here is decided until the owner accepts it. A fresh session needs only this file, those artifacts and the repo.

Cold start: Svelte 5 client in `packages/client/src` (`App.svelte`, `ServerList.svelte`, `Terminal.svelte`, `KeyRow.svelte`, `src/lib/`), wire types mirrored in `src/lib/protocol.ts`. Use `npx --yes pnpm@9`; unit tests `cd packages/client && npx --yes pnpm@9 test`; browser e2e and the phone check as in `docs/plans/termanch-v4-ops-and-feedback.md` and `docs/skills/mobile-ui-device-check.md`. The owner tests on an iPhone (Safari 16+ is the floor). One squashed PR per step, merge only on the owner's "merge".

## Goal

From the session list alone, see what each agent is doing and answer it with one tap, without opening the terminal. The card is what the owner reads between other things.

## Card (collapsed)

Name, tool icon, **state chip** (working, needs you, done, error, plus stale), **current tool line** ("Edit src/app.ts", "Running tests"), time since last change, one-line plan progress ("3/7"). All text comes from events already sanitised by the server; the client still renders it as plain text.

## Rules

- **Accessible by default.** A state is never shown by colour alone: each chip has a word and an icon. Changes to `needs you` are announced through an `aria-live="polite"` region. Tap targets are at least 44×44 px.
- **Stable order under the finger.** Cards are sorted with `needs you` first, but the order is frozen while a touch is down, a sheet is open, or the user scrolled in the last 2 s; reordering applies afterwards, with no animation that moves a button under a finger. A one-tap button therefore never lands on a different card than the one the user read.
- **One-tap answers act only on the prompt the user saw.** The button carries the event's prompt `id` and `seq`. The server accepts the keys only if that prompt is still the session's current one and re-checks the pane still matches; otherwise it refuses and the card says "that prompt changed", showing the new state.
- **Stale is visible.** A session with `stale=true` shows "no update for N min" and offers only "Open terminal".
- **Terminal always available.** The card never replaces the terminal. Destructive actions keep their confirmations (`kill-session-needs-confirmation`); the soft keyboard never hides the input (`soft-keyboard-never-hides-input`).
- **No agent data leaves the connection.** Cards render from events already sent to the browser.

## Steps

### K.1 Design pass with real screenshots — [>] moved to docs/plans/termanch-roadmap.md as R20
Class: design · Needs: v6 P.1 sample events · Check: screenshots exist under `docs/plans/assets/cards/` and the owner picks one.
Do: three card variants in the real client at 390 px wide (Playwright), in light and dark, with the states working, needs you, done, error and stale, including a long tool line and 20 sessions.
Done-when: the owner names the variant; the choice is noted in this plan.

### K.2 Card with state chip and current tool — [x]
Class: implement · Needs: v6 P.6, v2 A.3, K.1 · Check: `cd packages/client && npx --yes pnpm@9 test`; e2e screenshot gate on a fake event stream.
Do: 1. The collapsed card with the accessibility rules above. 2. The frozen-order sort. 3. The stale display. 4. A fallback when a session has no events yet: the existing plain row.
Done-when: unit tests cover chip text and icon for every state, `aria-live` on change, order frozen during a touch and applied after, stale text; the e2e screenshot matches at phone width.

### K.3 Plan panel and timeline — [x]
Class: implement · Needs: K.2 · Check: `cd packages/client && npx --yes pnpm@9 test`
Do: expanded card with the read-only checklist from `plan` events with status marks, and the last 10 `tool` events as a capped timeline; everything rendered as text.
Done-when: tests show plan items and tool events render escaped (a sample containing `<img onerror>` and control characters shows as plain text) and the lists stay capped.

### K.4 One-tap answers with confidence rules — [x] (needs the agent hook connected, see below)
Class: implement · Needs: v6 P.3 (reliable prompts), K.2 · Check: `cargo test -p termanch-server answer && cd packages/client && npx --yes pnpm@9 test`
Do: 1. Server message `Answer { session, prompt_id, seq, choice }` that sends the matching keys only when the prompt is still current and the pane matches; otherwise a typed error. 2. Client shows buttons only for `confidence=high` prompts. Low-confidence prompts show the last screen lines (capped, scrubbed) and a single "Open terminal" button. 3. Tools without hooks therefore get no one-tap answers; the card says why.
Done-when: tests prove a stale prompt id is refused, a changed pane is refused, a low-confidence prompt gets no answer buttons, and the keys sent for each choice are exactly the expected ones.

### K.5 Quick replies and snippets — [x]
Class: implement · Needs: K.2 · Check: `cd packages/client && npx --yes pnpm@9 test`
Do: a text field with saved snippets ("continue", "run the tests") stored in the user's settings; sends go to the chosen session; the field stays above the soft keyboard.
Done-when: tests cover snippet save, delete and send; the phone check shows the input visible with the keyboard open.

### K.6 Inbox view shared with connectors — [>] moved to docs/plans/termanch-roadmap.md as R13
Class: implement · Needs: v7 O.3, K.2 · Check: `cd packages/client && npx --yes pnpm@9 test`
Do: an inbox list of events (needs you, done, error) with unread count and tap-to-open-session; the same store as the Web Push inbox.
Done-when: tests show unread counts, mark-read on open, and the session opening from an item.

## Status (2026-10-13)

Built on tmux sessions and the v6 event stream; herdr is not a target (agreed). `SessionList.svelte` and `SessionCard.svelte` replace the plain rows; sessions with no events keep the plain row.

- **Cards:** chip with word and icon (never colour alone), tool line, age, plan progress, stale text; `aria-live` announcement when a session starts needing you; 44 px targets (checked in `e2e/cards.mjs`); order frozen while a finger is down, a card is expanded, or for 2 s after a scroll (`FrozenOrder`, unit-tested).
- **Answers (K.4):** `Answer {session, prompt_id, seq, choice}` is accepted only for the session's current prompt with the same id and event number, `confidence=high`, and the pane still showing the same question; the keys come from the screen's own choice list (digit, or `y`/`n` plus Enter), never from the client. A prompt is `high` only when the agent's own hook said `needs_input` within the last minute, so without `--connect-claude` the card says why there are no buttons. Tested with a fake backend for every refusal and a real tmux for capture and send.
- **Quick replies (K.5):** `Reply {session, text}` types one cleaned line plus Enter into the chosen session's pane without attaching; snippets are kept in the browser.
- **Not done:** K.6 (needs v7 O.3), a three-variant design pass for K.1, the unattached-pane limits of non-tmux managers (herdr has no capture or send).

## Open questions for the owner (recommended default first)

1. Which answers may be one tap? Recommended: yes/no and numbered choices on `confidence=high` prompts only; anything that edits outside the repository opens the terminal.
2. Cards on the session list or a separate Agents tab? Recommended: on the session list, with the Agents sort as a filter.
