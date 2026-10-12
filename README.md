# Termanch

A web terminal for managing remote AI coding agents (Codex, Claude Code, Herdr) from any phone or desktop browser. Sessions live in tmux on your own server and survive dropped connections. No native apps, no subscriptions, no relay in the middle.

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

Add Server offers two choices (decisions 0058 and 0075):

**In an isolated container** (the default). Sessions run inside a Docker container, in `/opt/termanch/home` (mounted as the container's home, so it survives restarts and upgrades). Docker is installed if missing. The container cannot see the rest of your VPS. The image has tmux, git, curl and Node. Install your agents in a Termanch session, for example:

```bash
npm install -g @anthropic-ai/claude-code @openai/codex
```

**On the machine itself** (no Docker). The server is a single static binary run as a systemd service, and sessions run directly on your VPS, where your repositories and agent tools already are. You choose between a dedicated unprivileged user `termanch` (created for you, recommended) and `root`. This gives your browser a shell on the server itself, so the app shows a warning and asks you to confirm. Requirements: systemd, `curl`, `ssh-keygen` (package `openssh-client`), x86_64 or aarch64; `tmux` is installed if missing.

The installer also sets up a daily update check that runs as root, separately from the server (which can stay an unprivileged user). Before anything is installed, and before every update, the release is checked: its manifest must carry a valid signature by the project's release key, and the binary must match the signed SHA-256 (see `SECURITY.md`). It lists every change it will make, records each one in a journal in `/var/lib/termanch-root` before making it, and can undo them.

### Updating and removing

Isolated container:

```bash
# update: run the install command again (any new secret works)
# remove:
docker rm -f termanch && sudo rm -rf /opt/termanch
```

On the machine itself:

```bash
# see what the installer changed, and what removing it would undo:
sudo termanch-server --revert --dry-run
# remove (stop the service and delete its state first; your repositories and the termanch user's home are never touched):
sudo systemctl stop termanch && sudo rm -rf /var/lib/termanch && sudo termanch-server --revert
# updates: a root-owned timer checks for a new signed release every day and applies it; if the new server does not
# come up healthy it puts the old one back. Check now: sudo termanch-server --root-helper update
# (older installs get the timer by running the install command again)
```

## Security model

- Terminal traffic goes browser ↔ your server only, over DTLS. Neither the directory nor Cloudflare carries it.
- The directory stores your server's public key, public address, port and certificate fingerprint, signed by the server. A tampered record is rejected because the client pins the key when you add the server.
- Your browser holds a device key that cannot be exported; after GitHub login the hosted function signs a 7-day certificate for it, and the GitHub token is dropped. Servers verify the certificate and a signature over a per-connection challenge that names the server, so a server cannot replay your login elsewhere. Only the owner's GitHub account is accepted (0062).
- Root on the VPS can always re-claim the server (it can read the same files).
- Details: `docs/decisions/` (0053, 0056, 0057) and `docs/facts/`.

## Hosting your own client

By default everything uses the hosted client at app.termanch.vivantel.dev. To run your own (your domain, your OAuth app, your directory) follow [docs/BOOTSTRAP.md](docs/BOOTSTRAP.md). Servers then need `TERMANCH_CLIENT_URL=https://your-client` (the install command carries it).

## Session backends

The default is tmux. To use another tool with a CLI, give three commands (no shell; `{name}` and `{id}` are replaced by a validated session name):

```
TERMANCH_BACKEND=command
TERMANCH_BACKEND_NAME=zellij
TERMANCH_BACKEND_LIST=zellij list-sessions --short
TERMANCH_BACKEND_CREATE=zellij attach --create-background {name}
TERMANCH_BACKEND_ATTACH=zellij attach {id}
```

The attach command runs in a PTY. It must repaint the session when it starts and only detach when it is killed; that is how a dropped connection resumes. The zellij lines are an illustration and untested; herdr's CLI is being verified (issue #22). Otherwise implement the `SessionBackend` trait (`packages/server/src/backend.rs`).

## Configuration

Server (environment variables of the container; the installer sets the first two):

| Variable | Description |
|---|---|
| `TERMANCH_UDP_PORT` | UDP port of the WebRTC transport (default 4443) |
| `TERMANCH_CLIENT_URL` | Client and directory origin (default https://app.termanch.vivantel.dev) |
| `TERMANCH_PUBLIC_IP` | Address clients connect to; detected when unset |
| `TERMANCH_WEBRTC` | `off` for WebSocket only |
| `TERMANCH_SERVER_NAME` | Display name |
| `TERMANCH_BACKEND` | `tmux` (default) or `command` |
| `TERMANCH_CONFIG_DIR` | Owner, keys and certificate (default `~/.config/termanch`) |

Client build: `VITE_GITHUB_CLIENT_ID`. The OAuth code exchange runs in a Pages Function that needs `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `CERT_SIGNING_KEY` (base64 PKCS#8 Ed25519) as secrets on the Pages project. Servers trust its public key from `packages/server/cert-keys.txt`; self-hosters set `TERMANCH_CERT_KEYS=kid=<base64url key>` on their servers.

## Development

```bash
cargo test --workspace                 # needs tmux for the end-to-end tests
cd packages/client && npx pnpm@9 install && ./node_modules/.bin/vitest run
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

The plan and its status live in GitHub issues; see `docs/plans/termanch-v1.md`.

## Roadmap

Mobile UX and installable PWA (#17, #18), agent notifications (#19), tunnel fallback for UDP-blocked networks (#26), end-to-end tests and resource gates (#21), other session backends (#22, #23).

## License

MIT
