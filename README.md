# Termanch

A web-based terminal for managing remote AI coding agents (Codex, Claude Code, Herdr) from any mobile browser, with Mosh-level session persistence. No native apps. No subscriptions. Self-hosted.

## Architecture

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│  Cloudflare     │ ◄─────────────────► │  Your VPS       │
│  Pages (Client) │                     │  (Docker)       │
└─────────────────┘                     └────────┬────────┘
                                                  │
                                         ┌────────┴────────┐
                                         │  termanch-server│
                                         │  termanch-agent │
                                         │  tmux sessions  │
                                         └─────────────────┘
```

- **Client**: Hosted at `https://app.termanch.dev` (Cloudflare Pages, our account)
- **Server**: Self-hosted on your VPS via Docker + Cloudflare Tunnel
- **Auth**: GitHub OAuth (our OAuth app)
- **Transport**: WebSocket (MVP), WebTransport (planned)
- **Terminal**: xterm.js WebGL in browser

## Quick Start

### 1. Deploy Server to Your VPS

```bash
# Clone and configure
git clone https://github.com/sergemso/termanch
cd termanch/docker
cp .env.example .env
# Edit .env with your GitHub OAuth credentials and secrets

# Generate secrets:
# openssl rand -base64 32  # for JWT_SECRET and REGISTRATION_SECRET

# Start with Cloudflare Tunnel (named tunnel)
docker compose up -d

# Or for quick testing without Cloudflare account:
# docker compose -f docker-compose.yml -f docker-compose.trycloudflare.yml up -d
```

### 2. Register Server

```bash
# Generate registration token
docker compose exec termanch-server termanch-server --register

# Output shows token + QR code - scan with Termanch app
```

### 3. Use the Client

1. Open `https://app.termanch.dev`
2. Login with GitHub
3. Click "Add Server" → scan QR code
4. Click server → terminal opens
5. Run `codex` or `claude-code` in tmux → notifications appear in UI

## Development

### Prerequisites

- Rust 1.79+
- Node.js 20+ / pnpm 9+
- Docker

### Build

```bash
# Build all Rust packages
cargo build --workspace --release

# Build client
pnpm install
pnpm --filter termanch-client build

# Build Docker image
docker build -t termanch -f docker/Dockerfile .
```

### Test

```bash
cargo test --workspace
pnpm --filter termanch-client test
```

## Project Structure

```
termanch/
├── packages/
│   ├── core/          # Shared protocol types (Rust)
│   ├── server/        # WebSocket server (Rust, Axum)
│   ├── agent/         # PTY/tmux manager (Rust)
│   └── client/        # Svelte 5 + xterm.js WebGL
├── docker/
│   ├── Dockerfile     # Multi-stage build
│   └── docker-compose.yml
├── .github/workflows/ # CI + Cloudflare Pages deploy
└── docs/              # Architecture decisions, plans
```

## MVP Scope (Current)

- ✅ GitHub OAuth login
- ✅ Server registration via QR + HMAC token
- ✅ WebSocket connection (cross-origin)
- ✅ tmux session list + attach
- ✅ Terminal with xterm.js WebGL
- ✅ Agent notifications (spawn/complete/error)
- ✅ Write prompts to agents via terminal

## Not in MVP

- WebTransport (WebSocket only)
- WASM terminal engine (xterm.js direct)
- SSH agent auth (GitHub OAuth only)
- SSP/CRDT sync (full frame deltas)
- Mobile PWA/offline/gestures/voice
- Self-hosted client option

## Configuration

### Server Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TERMANCH_GITHUB_CLIENT_ID` | Yes | GitHub OAuth App Client ID |
| `TERMANCH_GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth App Client Secret |
| `TERMANCH_JWT_SECRET` | Yes | 32+ char random string for JWT signing |
| `TERMANCH_REGISTRATION_SECRET` | Yes | 32+ char random string for HMAC |
| `TERMANCH_SERVER_NAME` | No | Display name (default: termanch-server) |
| `TERMANCH_HOST` | No | Bind address (default: 0.0.0.0) |
| `TERMANCH_PORT` | No | Port (default: 8080) |

### Client Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GITHUB_CLIENT_ID` | Yes | GitHub OAuth App Client ID |

## License

MIT