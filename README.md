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

See **[BOOTSTRAP.md](docs/BOOTSTRAP.md)** for complete setup instructions including:
- GitHub OAuth App creation
- Cloudflare Pages + custom domain setup
- Cloudflare Tunnel configuration
- Secret generation
- Server deployment on VPS
- Server registration via QR code
- Terraform infrastructure-as-code (optional)

### Minimal Quick Start

```bash
# 1. Create GitHub OAuth App (callback: https://app.yourdomain.com/callback)
# 2. Create Cloudflare Pages project + custom domain app.yourdomain.com
# 3. Generate secrets: openssl rand -base64 32 (x2 for JWT_SECRET, REGISTRATION_SECRET)

# On your VPS:
git clone https://github.com/sergemso/termanch
cd termanch/docker
cat > .env <<EOF
TERMANCH_GITHUB_CLIENT_ID=your-client-id
TERMANCH_GITHUB_CLIENT_SECRET=your-client-secret
TERMANCH_JWT_SECRET=your-jwt-secret
TERMANCH_REGISTRATION_SECRET=your-reg-secret
TERMANCH_SERVER_NAME=my-vps
EOF

docker compose up -d

# Register server:
docker compose exec termanch-server termanch-server --register
# Scan QR at https://app.yourdomain.com
```

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