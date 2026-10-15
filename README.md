# Termanch

A web terminal for managing remote AI coding agents (Codex, Claude Code) from any phone or desktop browser. Sessions live in tmux on your own server and survive dropped connections. No native apps, no subscriptions, no relay in the middle.

## How it works

```
 Browser (client)  ── WebRTC data channel, direct, end-to-end encrypted ──►  Your VPS
 app.termanch.vivantel.dev          one UDP port                               termanch-server + tmux
        │                                                                          │
        └── GitHub login ── signed directory (address + key, never traffic) ◄──────┘
```

- **Direct connection.** The browser talks to your server over a WebRTC data channel on one UDP port. No tunnel, domain, certificate or relay is needed. The channel is encrypted (DTLS) and the browser pins the server's fingerprint.
- **Persistence = tmux.** The server attaches a tmux client per connection. If your phone drops off the network, the session keeps running and reconnecting repaints the screen. Any session manager with a CLI can be used instead (see Session backends).
- **Owner only.** The first GitHub user to connect becomes the server's owner; everyone else is refused.
- **Free to run.** The client and a small signed directory run on Cloudflare's free tier. Your server needs a VPS with 512 MB of RAM and a public IP.

## Quick start

You need a Linux VPS with a public IP (512 MB RAM, 1 vCPU is enough) and root access.

1. Open **https://app.termanch.vivantel.dev** and log in with GitHub.
2. Choose **Add Server**. Copy the command it shows and run it on your VPS.
3. Wait a minute. The server appears in the list. Tap it.

That is the whole setup. The command picks a free UDP port, starts the server and hands it a one-time secret. It is safe to run again; running it with a new secret re-claims the server for a new owner. Add Server also asks **where sessions should run** (see below).

**Prefer to scan?** On the VPS run `curl -fsSL https://app.termanch.vivantel.dev/install.sh | sh -s -- - https://app.termanch.vivantel.dev`. It shows a QR code; in Add Server choose **Scan a QR** and use the camera, or take a screenshot of the code and pick it from the gallery (delete the screenshot afterwards).

### Firewalls

The server needs **one inbound UDP port** (the installer picks a free one, usually 4443, and opens it in `ufw` or `firewalld` if they are active). If you use a provider firewall or security group (AWS, GCP, Oracle, Hetzner Cloud Firewall), open that port there. The app tells you which port when it cannot reach your server: *"Server unreachable on UDP port N"*. To see the port: `cat /opt/termanch/udp_port` (isolated container) or `sudo cat /var/lib/termanch-root/udp_port` (on the machine).

Some mobile and corporate networks block UDP. Those clients cannot connect until the tunnel fallback is available (see the roadmap).

### Where your agents run

Add Server offers two places (decisions 0058, 0075 and 0078):

**In an isolated container** (the default). Sessions run inside a Docker container, in `/opt/termanch/home` (mounted as the container's home, so it survives restarts and upgrades). Docker is installed if missing. The container cannot see the rest of your VPS. The image has tmux, git, curl and Node. Install your agents in a Termanch session, for example:

```bash
npm install -g @anthropic-ai/claude-code @openai/codex
```

**On the machine itself** (no Docker). The server is a single static binary run as a systemd service, and sessions run directly on your VPS, where your repositories and agent tools already are. You choose who the sessions run as: a dedicated unprivileged user `termanch` (created for you, recommended), the user who runs the install command (sessions open on your behalf, in your home, with your repositories, keys and agent logins; nothing is created), or `root`. This gives your browser a shell on the server itself, so the app shows a warning and asks you to confirm. Requirements: systemd, `curl`, `ssh-keygen` (package `openssh-client`), x86_64 or aarch64; `tmux` is installed if missing.

The installer also sets up a daily update check that runs as root, separately from the server (which can stay an unprivileged user). Before anything is installed, and before every update, the release is checked: its manifest must carry a valid signature by the project's release key, and the binary must match the signed SHA-256 (see `SECURITY.md`). It lists every change it will make, records each one in a journal in `/var/lib/termanch-root` before making it, and can undo them.

### Updating and removing

Remove the server from the machine with one command. Without `--yes` it only shows what it would do:

```bash
curl -fsSL https://app.termanch.vivantel.dev/uninstall.sh | sudo sh            # preview, changes nothing
curl -fsSL https://app.termanch.vivantel.dev/uninstall.sh | sudo sh -s -- --yes
```

It handles both install kinds. For the container it removes the container and `/opt/termanch`. On the machine itself it stops the service and the updater, deletes the server's state and undoes every journaled change (binary, units, firewall rule, and the `termanch` user and tmux only if the installer added them). It never touches your repositories, or the home of the user your sessions run as. Add `--keep-state` to keep the server's keys and owner, `--delete-home` to also delete the home of a `termanch` user the installer created. Running tmux sessions are left alone. Then use **Remove server** in the app to drop it from your list; you can also uninstall from there while connected.

Updates: the container updates when you run the install command again. On the machine itself a root-owned timer checks for a new signed release every day; if the new server does not come up healthy the old one is put back. Check now: `sudo termanch-server --root-helper update`.

## Sessions, tabs and windows

- **Tabs.** Each running session is a tab at the top, showing the folder and the agent of the window it speaks for; sessions from every saved server share one strip. Several sessions in the same folder are told apart by name. Tap an inactive tab to open it (its last screen shows at once, then the live one), tap the active tab for its windows, long-press for actions.
- **Windows.** The dropdown of the active tab lists the tmux windows of the session: switch to one, close it (a running program or the last window asks first), or open a new one with **+ New window** in the folder of the current window.
- **Detach or close.** Detach hides the tab and keeps the session running; Close session asks first and ends it.
- **Needs you.** When an agent waits for an answer, a banner names the session and offers its choices without changing the tab you are on.
- **Servers.** The Servers screen lists the saved servers; Add Server shows the install command for a container or for host mode and waits for the server to appear.

These behaviours are tested in a real browser (`packages/client/e2e/`), including two real server processes with real tmux. The browser runs emulate a phone; the soft keyboard, safe areas and gestures on a real iPhone are checked by hand with `docs/skills/mobile-ui-device-check.md`.

## Is it safe to use?

What a stranger on the internet can and cannot do, and what you accept by installing:

- **Only you can open a session.** The first GitHub account to connect owns the server; everyone else is refused. Your browser holds a device key that cannot be exported, and the server checks a certificate for it on every connection.
- **Your terminal traffic never touches our servers.** It goes from your browser to your machine, encrypted. The free directory only maps your server's public key to its address.
- **Your GitHub token is not kept.** It is used once to sign the certificate and dropped.
- **Host install = a shell on your machine, for your browser.** Whoever controls your GitHub account and an enrolled browser can run commands as the user the sessions run as. That is the product; choose the narrowest option you can live with: the isolated container, then a dedicated `termanch` user, then your own user, then root. Turn on two-factor authentication on GitHub.
- **Nothing is installed silently.** The installer lists every change first, records each in a journal before making it, and can undo all of them. Binaries are checked against a signature by the release key before they run, on install and on every update; a signed freeze can stop updates.
- **Nothing else runs as root.** The server runs as an unprivileged user; root work (updates, removal) is done by a separate small helper that accepts only a fixed list of requests.
- **What we cannot protect against:** a compromised machine, a stolen unlocked phone with an enrolled browser (remove the device in the app), or a malicious agent you run in a session.

Full model and how to report a problem: [SECURITY.md](SECURITY.md).

## Hosting your own client

By default everything uses the hosted client at app.termanch.vivantel.dev. To run your own (your domain, your OAuth app, your directory) follow [docs/BOOTSTRAP.md](docs/BOOTSTRAP.md). Servers then need `TERMANCH_CLIENT_URL=https://your-client` (the install command carries it).

## Session backends

The default (`TERMANCH_BACKEND=auto`) uses tmux. To use another tool with a CLI, give three commands (no shell; `{name}` and `{id}` are replaced by a validated session name):

```
TERMANCH_BACKEND=command
TERMANCH_BACKEND_NAME=zellij
TERMANCH_BACKEND_LIST=zellij list-sessions --short
TERMANCH_BACKEND_CREATE=zellij attach --create-background {name}
TERMANCH_BACKEND_ATTACH=zellij attach {id}
```

The attach command runs in a PTY. It must repaint the session when it starts and only detach when it is killed; that is how a dropped connection resumes. The zellij lines are an illustration and untested. Otherwise implement the `SessionBackend` trait (`packages/server/src/backend.rs`).

## Agent events

The server turns what agents do into a small typed stream (idle, working, needs input, done) that clients can follow. With no setup it comes from a process scan and screen heuristics (low confidence). For exact tool and "needs input" events from Claude Code, opt in:

```
termanch-server --connect-claude          # shows the hook lines it would add
termanch-server --connect-claude --yes    # applies them (backup kept)
termanch-server --disconnect-claude       # removes exactly those again
```

Only sessions created by Termanch carry the variables hooks need. Agent text in events is cleaned (control characters, secrets, addresses) and capped before it is stored or sent. Details: `docs/plans/archive/termanch-v6-agent-events.md`.

## Configuration

Server (environment variables of the container; the installer sets the first two):

| Variable | Description |
|---|---|
| `TERMANCH_UDP_PORT` | UDP port of the WebRTC transport (default 4443) |
| `TERMANCH_CLIENT_URL` | Client and directory origin (default https://app.termanch.vivantel.dev) |
| `TERMANCH_PUBLIC_IP` | Address clients connect to; detected when unset |
| `TERMANCH_WEBRTC` | `off` for WebSocket only |
| `TERMANCH_SERVER_NAME` | Display name; default: the host's short hostname (the installer passes it into the container) |
| `TERMANCH_BACKEND` | `tmux` (default) or `command` |
| `TERMANCH_CONFIG_DIR` | Owner, keys and certificate (default `~/.config/termanch`) |

Client build: `VITE_GITHUB_CLIENT_ID`. The OAuth code exchange runs in a Pages Function that needs `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `CERT_SIGNING_KEY` (base64 PKCS#8 Ed25519) as secrets on the Pages project. Servers trust its public key from `packages/server/cert-keys.txt`; self-hosters set `TERMANCH_CERT_KEYS=kid=<base64url key>` on their servers.

## Development

```bash
cargo test --workspace                 # needs tmux for the end-to-end tests
cd packages/client && npx pnpm@9 install && ./node_modules/.bin/vitest run
# browser end-to-end (needs a built server, `pnpm build`, `pnpm e2e:build` and Chrome)
node e2e/run.mjs && node e2e/touch.mjs && node e2e/cards.mjs && node e2e/windows.mjs && node e2e/two-servers.mjs
```

All builds and image publishing run in CI (`.github/workflows/`). Layout:

```
packages/core     shared protocol types (Rust)
packages/server   termanch-server: auth, sessions, WebRTC + WebSocket transports, directory announcer
packages/client   Svelte 5 + xterm.js client, Pages Functions (OAuth exchange, signed directory)
packages/agent    parked (agent detection moves into the server, issue #19)
docker/           image (built by CI) and a sample compose file
docs/             facts, decisions, guardrails, plans
```

The plan and its status live in GitHub issues; see `docs/plans/termanch-roadmap.md`.

## Roadmap

Mobile UX, the installable PWA, agent notifications, end-to-end tests and resource gates are done. What comes next is ordered in `docs/plans/termanch-roadmap.md`.

## License

MIT
