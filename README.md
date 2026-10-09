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

See **[BOOTSTRAP.md](docs/BOOTSTRAP.md)** for complete setup instructions.

### Automated Cloud Setup (Terraform)

```bash
# 1. Prerequisites: Cloudflare API token, GitHub Actions token, domain on Cloudflare
# 2. Create GitHub OAuth App manually (one-time):
#    GitHub Settings → Developer settings → OAuth Apps → New OAuth App
#    Callback: https://app.yourdomain.com/callback
#    Save Client ID and Client Secret

# 2. Run Terraform (automates: Cloudflare Pages, DNS, GitHub Actions secrets)
cd infra/termanch-cloud
cat > terraform.tfvars <<EOF
cloudflare_api_token         = "your-cf-api-token"
cloudflare_account_id        = "your-cf-account-id"
cloudflare_zone_name         = "yourdomain.com"
cloudflare_pages_deploy_token = "your-pages-deploy-token"
github_actions_token         = "your-fine-grained-pat"
github_oauth_client_id       = "your-github-oauth-client-id"
github_oauth_client_secret   = "your-github-oauth-client-secret"
github_repository            = "sergemso/termanch"
EOF

terraform init && terraform apply

# 3. Get outputs
terraform output oauth_client_id
terraform output oauth_client_secret
terraform output client_url
```

### Server Deployment (Your VPS)

```bash
# On your VPS:
git clone https://github.com/sergemso/termanch
cd termanch/docker
cat > .env <<EOF
TERMANCH_GITHUB_CLIENT_ID=<terraform output oauth_client_id>
TERMANCH_GITHUB_CLIENT_SECRET=<terraform output oauth_client_secret>
TERMANCH_JWT_SECRET=<openssl rand -base64 32>
TERMANCH_REGISTRATION_SECRET=<openssl rand -base64 32>
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