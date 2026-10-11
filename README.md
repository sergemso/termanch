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

- **Client**: Termanch-hosted at `app.termanch.dev` (quick start), or self-hosted on your Cloudflare Pages at `app.{yourdomain}` (or `app.{project}.{yourdomain}` with optional `pages_project_name`)
- **Server**: Self-hosted on your VPS via Docker + Cloudflare Tunnel
- **Auth**: GitHub OAuth (our OAuth app)
- **Transport**: WebSocket (WebTransport deferred)
- **Terminal**: xterm.js WebGL in browser

## Quick Start

See **[BOOTSTRAP.md](docs/BOOTSTRAP.md)** for complete setup instructions.

### Automated Cloud Setup (Terraform)

```bash
# 1. Prerequisites: Cloudflare API token, GitHub Actions token, domain on Cloudflare
# 2. Create GitHub OAuth App manually (one-time):
#    GitHub Settings → Developer settings → OAuth Apps → New OAuth App
#    Callback: https://app.{yourdomain}/callback (or https://app.{project}.{yourdomain}/callback)
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
github_repository            = "termanch"
# Optional: Pages project name (enables app.{project}.{zone} / api.{project}.{zone})
# pages_project_name = "myapp"
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
TERMANCH_SERVER_NAME=my-vps
# TERMANCH_CLIENT_URL=https://app.<yourdomain>   # only for a self-hosted client
EOF

docker compose up -d

# Register: shows a QR code and a link. Scan the QR with Termanch (or your phone's camera),
# or open the link in the browser where you are logged in. The first GitHub user to connect
# becomes the server's owner; the code works for 15 minutes, once.
docker compose exec -t termanch-server termanch-server --register
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
- ✅ Server registration via a one-time link; the first GitHub user to connect becomes the owner (DECISION-0053)
- ✅ WebSocket connection (cross-origin)
- ✅ tmux session list + attach
- ✅ Terminal with xterm.js WebGL
- ✅ Agent notifications (spawn/complete/error)
- ✅ Write prompts to agents via terminal

## Not yet built

Direction and steps: [docs/plans/termanch-v1.md](docs/plans/termanch-v1.md) (tracked in GitHub issues).

- Mobile UX, installable PWA, reconnect with screen replay
- Single-owner server binding (a server belongs to one GitHub user)
- Deferred designs, each needing a new decision: WebTransport, WASM/SSP sync, SSH-agent auth, end-to-end encryption

## Configuration

### Server Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TERMANCH_CLIENT_URL` | No | Client that opens the link (default: https://app.termanch.dev) |
| `TERMANCH_BACKEND` | No | `tmux` (default) or `command` (see Session backends) |
| `TERMANCH_UDP_PORT` | No | UDP port of the WebRTC-direct transport (default 4443; open it in the firewall) |
| `TERMANCH_PUBLIC_IP` | No | Address clients connect to; detected when unset (set it if detection fails) |
| `TERMANCH_WEBRTC` | No | `off` for WebSocket only |
| `TERMANCH_CONFIG_DIR` | No | Where the owner and claim token are stored (a volume) |
| `TERMANCH_SERVER_NAME` | No | Display name (default: termanch-server) |
| `TERMANCH_HOST` | No | Bind address (default: 0.0.0.0) |
| `TERMANCH_PORT` | No | Port (default: 8080) |

### Session backends

Sessions live in a session manager the server drives (DECISION-0054). The default is tmux
(`TERMANCH_BACKEND=tmux`). To use another tool with a CLI, give three commands (no shell; `{name}` and
`{id}` are replaced by a validated session name):

```
TERMANCH_BACKEND=command
TERMANCH_BACKEND_NAME=zellij
TERMANCH_BACKEND_LIST=zellij list-sessions --short
TERMANCH_BACKEND_CREATE=zellij attach --create-background {name}
TERMANCH_BACKEND_ATTACH=zellij attach {id}
```

The attach command runs in a PTY. It must repaint the session when it starts and only detach when it is
killed; that is how a dropped connection resumes. The zellij lines above are an illustration and not
tested; herdr's CLI is being verified in plan step 7.1. Without a backend that fits, implement the
`SessionBackend` trait (`packages/server/src/backend.rs`).

### Client Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GITHUB_CLIENT_ID` | Yes | GitHub OAuth App Client ID (build time) |

The OAuth code exchange runs in a Cloudflare Pages Function (`packages/client/functions/api/oauth/exchange.ts`).
Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` as secrets on the Pages project
(`wrangler pages secret put GITHUB_CLIENT_SECRET --project-name <project>`). Servers hold no OAuth secret;
they ask GitHub who a token belongs to.

## License

MIT