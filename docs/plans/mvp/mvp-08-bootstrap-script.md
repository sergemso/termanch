# MVP-08: Bootstrap Script with TUI Wizard

**Owner**: Architect | **Duration**: 1 day | **Depends on**: mvp-06 (docker)

## Goal
Single-command install (`curl | bash`) that sets up Docker, writes compose file, starts services, prints QR — all via minimal TUI wizard.

## User Flow (4 keypresses)
```bash
curl -fsSL https://get.termanch.dev | bash
```
1. **Welcome** → [Enter]
2. **Tunnel type** → [Enter] (default: Quick Tunnel) or [↓][Enter] (Named)
3. **Running...** (auto, no input)
4. **QR displayed** → [Enter] Done

## Architecture

### Components
- **Bootstrap script**: `scripts/bootstrap.sh` (hosted at get.termanch.dev)
- **TUI library**: `gum` (single binary, downloaded at runtime)
- **Docker Compose**: `docker-compose.yml` + `.env` (written to `/opt/termanch/`)
- **Services**: `termanch-server` + `termanch-agent` + `cloudflared` (sidecar)

### Directory Structure on VPS
```
/opt/termanch/
├── docker-compose.yml
├── .env                    # Generated secrets
├── data/                   # Persistent volumes (tmux sockets, etc.)
└── scripts/
    └── generate_qr.sh      # QR generation helper
```

## Bootstrap Script Logic

### Phase 1: Preflight
```bash
# Detect OS (Ubuntu 22.04+/Debian 12+)
# Check: root/sudo, systemd, architecture (amd64/arm64)
# Install: docker.io, docker-compose-plugin, curl, jq, qrencode
```

### Phase 2: TUI Wizard (gum)
```bash
# gum style --title "Termanch Server Setup" ...
# gum choose "Quick Tunnel (trycloudflare)" "Named Tunnel (my Cloudflare)"
# If Named: gum input --placeholder "Tunnel token from dashboard"
```

### Phase 3: Generate Secrets
```bash
JWT_SECRET=$(openssl rand -base64 32)
REGISTRATION_SECRET=$(openssl rand -base64 32)
SERVER_NAME=$(hostname)
```

### Phase 4: Write Configs
```bash
# docker-compose.yml (template with sidecar pattern)
# .env with all secrets + tunnel config
```

### Phase 5: Start Services
```bash
docker compose -f /opt/termanch/docker-compose.yml up -d
# Wait for health checks
```

### Phase 6: Get Tunnel URL + Generate QR
```bash
# Quick tunnel: parse cloudflared logs for trycloudflare URL
# Named tunnel: construct from token
# HMAC_TOKEN=$(compute_hmac REGISTRATION_SECRET)
# qrencode -t ANSIUTF8 "$HMAC_TOKEN"
```

### Phase 7: Display Result
```bash
# Print QR in terminal (ANSI)
# Print instructions: "Open https://app.termanch.dev → Login → Scan QR"
```

## Docker Compose Template (sidecar pattern)
```yaml
services:
  termanch-server:
    image: ghcr.io/sergemso/termanch:latest
    environment:
      - TERMANCH_HOST=0.0.0.0
      - TERMANCH_PORT=8080
      - TERMANCH_GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
      - TERMANCH_GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
      - TERMANCH_JWT_SECRET=${JWT_SECRET}
      - TERMANCH_REGISTRATION_SECRET=${REGISTRATION_SECRET}
      - TERMANCH_SERVER_NAME=${SERVER_NAME}
    volumes:
      - ./data:/home/termanch/.config/termanch
    networks: [termanch-net]
    restart: unless-stopped

  termanch-agent:
    image: ghcr.io/sergemso/termanch:latest
    command: termanch-agent
    environment:
      - TERMANCH_SERVER_URL=ws://termanch-server:8080/ws
      - TERMANCH_SERVER_TOKEN=${REGISTRATION_SECRET}
      - TERMANCH_SOCKET_PATH=/tmp/termanch-agent.sock
    volumes:
      - /tmp/termanch-agent.sock:/tmp/termanch-agent.sock
      - /var/run/docker.sock:/var/run/docker.sock:ro
    depends_on: [termanch-server]
    networks: [termanch-net]
    restart: unless-stopped

  cloudflared:
    image: cloudflare/cloudflared:latest
    command: {{TUNNEL_CMD}}
    # Quick: tunnel --no-autoupdate --url http://termanch-server:8080
    # Named: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on: [termanch-server]
    networks: [termanch-net]
    restart: unless-stopped

networks:
  termanch-net:
    driver: bridge
```

## Quick Tunnel URL Extraction
```bash
# cloudflared logs: "https://adjective-noun-animal.trycloudflare.com"
docker compose logs -f cloudflared | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | head -1
```

## Named Tunnel Config
User provides token from Cloudflare dashboard → added to `.env`:
```env
CLOUDFLARE_TUNNEL_TOKEN=eyJh...
```

## Security
- `.env` permissions: `chmod 600`
- Secrets generated per-install (not derived)
- No secrets in image, only in mounted `.env`
- HMAC token single-use, 10-min expiry

## CI/CD for Bootstrap Script
- Script in `scripts/bootstrap.sh`
- `.github/workflows/bootstrap-publish.yaml`:
  - On tag `bootstrap-v*`: upload script to GH Pages or R2
  - Served at `https://get.termanch.dev` (Cloudflare Pages custom domain)

## Definition of Done
1. `curl -fsSL https://get.termanch.dev | bash` works on fresh Ubuntu 22.04 VPS
2. TUI wizard completes in ≤ 4 keypresses (default path)
3. Services healthy: `docker compose ps` shows all running
4. QR code renders in terminal, scannable by phone
5. Client at app.termanch.dev connects, terminal works
6. Survives reboot: `systemctl enable docker` + compose restart policy

## Dependencies on Host
| Package | Purpose | Install method |
|---------|---------|----------------|
| docker.io | Container runtime | apt |
| docker-compose-plugin | compose command | apt |
| curl | Download script | apt (pre-installed) |
| jq | JSON parsing | apt |
| qrencode | QR in terminal | apt |

## Edge Cases
- **Docker already installed**: Skip, verify version ≥ 24
- **Port 8080 in use**: Detect, offer alternative port
- **No public IP**: Quick tunnel works (outbound only)
- **ARM64 VPS**: Multi-arch images support it
- **Re-run script**: Detect existing install, offer update/reinstall