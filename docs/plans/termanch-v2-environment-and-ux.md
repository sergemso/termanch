# Termanch Roadmap: environment, app, session and agent UX

Builds on `termanch-v1.md` (which still owns #15–#23). Items here are proposals until their issue is opened and a decision is recorded.

## Principles
1. Zero config by default, every knob one tap away. A first-time user gets a working terminal with an agent installed.
2. The server is the source of truth (DECISION-0054). The browser holds no state it cannot rebuild from the server plus the signed directory.
3. Free tier only. Every item below states its request/memory cost.
4. Phone first: each screen is designed at 360×640, then widened.

## A. Environment (where terminals run, and what is in them)

### A1. Run mode: Container or Host
- Add Server asks: **Isolated container** (default) or **This host** (warning: the owner gets root on the VPS).
- Carried in the install command/QR as a trailing word; the installer starts the container with `--pid=host --privileged` for host mode and sets `TERMANCH_RUN=host`.
- The server runs session commands through `nsenter -t 1 -m -u -i -n -p`; a startup self-check fails loudly with the reason.
- The mode is shown in the server card and the session header ("host" badge in amber).

### A2. Environment profile (checkboxes in Add Server, editable later in Server settings)
| Component | Default | Notes |
|---|---|---|
| tmux | on | session persistence backend |
| herdr | on | agent multiplexer, see A3 |
| zellij | off | alternative multiplexer |
| claude, codex | off, one tap each | installed with npm into the persistent home |
| git, ssh, curl | on | already in the image |
| mosh-style prediction | later | backlog |
- A profile is a JSON list stored on the server (`$CONFIG/env.json`) and applied by an idempotent `termanch-server --ensure-env`, run on start and when the client sends `set_env`.
- Container mode installs into the volume (no image rebuild). Host mode uses the host package manager (apt/dnf/apk detected) and only for components the owner ticked.
- Each install streams progress to the client and is audit-logged without output content.

### A3. herdr in the image, kept current
- The image ships herdr (release binary `herdr-linux-{x86_64,aarch64}` from GitHub releases, fetched in the Dockerfile).
- Updates: a small `termanch-updater` checks the releases API once per 24 h (1 request/day/server; GitHub allows 60/h unauthenticated), downloads into `$HOME/.local/bin` on the persistent volume, verifies the asset's checksum when published, keeps the previous binary for rollback. No restart needed for new sessions.
- CI rebuilds the image weekly and on every herdr release (scheduled workflow) so fresh installs start current. Same mechanism updates tmux/node base through the base image.
- Needs #22 (herdr verdict) first; if herdr does not fit the command backend, a dedicated adapter is part of that item.

### A4. Server self-update
Container: a `termanch-server --update` check shown in Server settings ("new image available"), applied by the installer one-liner re-run (pull + recreate, volume kept). Host-mode also offers it as a button that runs the same recreate through the Docker socket if mounted.

## B. App (hosted client)
- **Home** = servers list with live state (online/offline from directory freshness, last seen, mode badge, running sessions and agents count).
- **Server settings**: name, mode, environment profile (A2), update status, re-claim (new owner), remove.
- **Cross-device list**: the owner's servers sync through the directory (server ids keyed by GitHub id; one small D1 row per owner). One request on login. Removes the "empty in another browser" gap. Cost: 1 read + (rarely) 1 write per login; far below the 100k/day limit.
- **PWA** (#18): install prompt, offline shell, resume triggers reconnect.
- **Settings**: font size, theme, key row layout, haptics, notifications.

## C. Sessions
- Session list per server with name, backend (tmux/herdr), cwd, running command, last activity, unread badge.
- Create session from a template: Shell, Claude Code, Codex, herdr workspace, custom command; choose directory (recent repos list from the server).
- Rename, kill (confirm), duplicate. Swipe actions on mobile.
- Multiple panes: a switcher (tabs on desktop, bottom sheet on phone), not split panes on phones.
- Reconnect = re-attach with screen replay (#16); a banner shows state (connecting / reconnected / server down) and never blocks typing.
- Scrollback search and copy mode; share a read-only view link (backlog).

## D. Terminal UX (#17)
- Key row: Esc, Tab, Ctrl (sticky), Alt, arrows, `|`, `~`, `/`, paste; soft-keyboard-aware viewport (visualViewport).
- Gestures: scroll, two-finger tap for paste, pinch for font size, long-press select.
- Latency: show the transport (direct/WebSocket) and RTT in the status bar.
- Accessibility: contrast themes, large text, screen reader labels for controls.

## E. Agent UX (#19)
- Detection in the server: process scan of each pane's tree for claude/codex/herdr, with a state model **idle → working → needs input → done/error**.
- Session list shows state chips; a global "needs you" inbox lists sessions waiting for input, newest first.
- Notifications: in-app toasts, tab title badge, installed-PWA Web Push (VAPID, no paid service; payload carries no terminal text).
- Quick answers: when an agent waits for y/n or a numbered choice, offer buttons that send the keystroke.
- Agent run log per session (start, end, state changes), no output retained beyond tmux scrollback.
- Later: diff viewer, file browser, prompt library, voice input (browser speech API).

## Phasing and issues
| Phase | Items | Needs |
|---|---|---|
| 0 | finish v1: #15, #16, #21, #20 | now |
| 1 | A1 run mode, B cross-device list | after #16 |
| 2 | #22 herdr verdict, A3 herdr + updater, A2 profile | #22 |
| 3 | #17 mobile terminal UX, #18 PWA, C session list and templates | #16 |
| 4 | #19 / E agent states, inbox, push | #16, #18 |
| 5 | A4 self-update, search, share links | phase 2 |

## Capacity math (free tier)
- Directory: a claimed server re-announces every 12 h (`REFRESH_EVERY`, `directory.rs`), an unclaimed one every 5 min, plus on IP/claim change: ~2 requests/day/server, so 10k servers use ~20k of the 100k/day Workers limit. Lookups add one per reconnect that has no cached record.
- Cross-device list: ~2 requests per login; negligible.
- herdr/tool updates: GitHub API from each server, 1/day; no Cloudflare cost.
- Image: herdr adds a single static binary (order of 10 MB); target stays under the 512 MB RAM gate; track image size in the #21 gates.

## Risks
| Risk | Mitigation |
|---|---|
| Host mode = root on the VPS | explicit warning, owner-only, audit log, off by default |
| herdr API/CLI unstable or not fitting the backend shape | #22 verdict first; pin the last good version, rollback |
| Auto-update ships a broken binary | checksum, keep previous, health check after switch |
| Per-package installs on host differ by distro | detect package manager, support apt first, document the rest |
