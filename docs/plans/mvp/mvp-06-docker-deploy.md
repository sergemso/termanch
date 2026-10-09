# MVP-06: Docker Deployment (Server + Agent + Cloudflare Tunnel)

**Owner**: Architect | **Duration**: 1 day | **Depends on**: mvp-03, mvp-04, mvp-05

## Goal
Single Docker Compose deployment for user's VPS: server + agent + cloudflared tunnel.

## Do
1. **`docker/Dockerfile`** — Multi-stage, server-only:
   ```dockerfile
   # Stage 1: Builder
   FROM rust:1.80-bookworm AS builder
   WORKDIR /app
   COPY . .
   RUN cargo build --release --workspace --exclude termanch-client

   # Stage 2: Runner
   FROM debian:bookworm-slim
   RUN apt-get update && apt-get install -y ca-certificates tmux qrencode && rm -rf /var/lib/apt/lists/*
   COPY --from=builder /app/target/release/termanch-server /usr/local/bin/
   COPY --from=builder /app/target/release/termanch-agent /usr/local/bin/
   COPY docker/entrypoint.sh /entrypoint.sh
   RUN chmod +x /entrypoint.sh
   
   EXPOSE 443
   ENTRYPOINT ["/entrypoint.sh"]
   ```

2. **`docker/entrypoint.sh`** — Init script:
   ```bash
   #!/bin/bash
   set -e
   
   CONFIG_DIR="/config"
   SECRET_FILE="$CONFIG_DIR/registration_secret"
   
   # Generate registration secret if not exists
   if [ ! -f "$SECRET_FILE" ]; then
       openssl rand -hex 32 > "$SECRET_FILE"
       chmod 600 "$SECRET_FILE"
   fi
   
   REGISTRATION_SECRET=$(cat "$SECRET_FILE")
   export REGISTRATION_SECRET
   
   # Handle --register flag
   if [ "$1" = "--register" ]; then
       SERVER_ID=$(openssl rand -hex 16)
       TOKEN=$(echo -n "$SERVER_ID" | openssl dgst -sha256 -hmac "$REGISTRATION_SECRET" -binary | xxd -p -c 32)
       echo "Registration Token: $TOKEN"
       echo "Server ID: $SERVER_ID"
       echo "otpauth://totp/termanch?secret=$TOKEN&issuer=Termanch" | qrencode -t ANSIUTF8
       exit 0
   fi
   
   # Start agent as user (UID 1000)
   sudo -u "#1000" termanch-agent &
   
   # Start server
   exec termanch-server --config "$CONFIG_DIR/server.toml"
   ```

3. **`docker/compose.yaml`** — User's VPS deployment:
   ```yaml
   services:
     termanch-server:
       build:
         context: ..
         dockerfile: docker/Dockerfile
       volumes:
         - ./config:/config
environment:
          - TERMANCH_GITHUB_CLIENT_ID
          - TERMANCH_GITHUB_CLIENT_SECRET
         - ALLOWED_ORIGIN=https://app.termanch.dev
       depends_on:
         - cloudflared
       restart: unless-stopped

     cloudflared:
       image: cloudflare/cloudflared:latest
       # Option A: Named tunnel (recommended, requires Cloudflare account)
       # command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
       # Option B: TryCloudflare (zero-setup, random subdomain)
       command: tunnel --no-autoupdate --url http://termanch-server:443
       restart: unless-stopped
       # For Option A, add: environment: - CLOUDFLARE_TUNNEL_TOKEN

     termanch-agent:
       build:
         context: ..
         dockerfile: docker/Dockerfile
       command: termanch-agent
       volumes:
         - /home/user/.termanch:/home/user/.termanch
         - /var/run/docker.sock:/var/run/docker.sock
       user: "1000:1000"
       depends_on:
         - termanch-server
       restart: unless-stopped
   ```

4. **`docker/.env.example`** — User configuration:
    ```bash
    # Required: GitHub OAuth app credentials (from github.com/settings/developers)
    TERMANCH_GITHUB_CLIENT_ID=your_client_id
    TERMANCH_GITHUB_CLIENT_SECRET=your_client_secret
   
   # Optional: Cloudflare Tunnel token (for named tunnel)
   # CLOUDFLARE_TUNNEL_TOKEN=your_tunnel_token
   ```

5. **`docs/user-setup.md`** — VPS deployment guide:
   ```markdown
   # User Setup Guide
   
   ## Prerequisites
   - VPS with 512MB RAM, 1 vCPU (Hetzner CX22, DigitalOcean Basic, etc.)
   - Domain (optional, for named tunnel)
   - GitHub OAuth App (create at github.com/settings/developers)
     - Homepage: https://app.termanch.dev
     - Callback: https://app.termanch.dev/callback
   
   ## Quick Start
   ```bash
   # 1. Clone repo
   git clone https://github.com/termanch/termanch.git
   cd termanch/docker
   
   # 2. Configure
   cp .env.example .env
   # Edit .env with your GitHub OAuth credentials
   
   # 3. Start
   docker compose up -d
   
   # 4. Register server
   docker compose exec termanch-server termanch-server --register
   # Scan the QR code in https://app.termanch.dev
   
   # 5. Done! Open https://app.termanch.dev
   ```
   
   ## Cloudflare Tunnel Options
   
   ### Option A: TryCloudflare (Zero Setup, Random Subdomain)
   - No Cloudflare account needed
   - Runs automatically with default compose.yaml
   - URL changes on restart (re-register server)
   
   ### Option B: Named Tunnel (Stable URL, Requires Account)
   - Create tunnel at dash.cloudflare.com → Zero Trust → Networks → Tunnels
   - Copy token to `.env` as `CLOUDFLARE_TUNNEL_TOKEN`
   - Uncomment `command` line in compose.yaml
   - Stable URL: `https://your-subdomain.trycloudflare.com`
   
   ## TLS
   - Cloudflare Tunnel provides automatic valid TLS
   - No cert management needed
   
   ## Updating
   ```bash
   git pull
   docker compose build --no-cache
   docker compose up -d
   ```
   ```

## Check
```bash
docker build -t termanch:mvp -f docker/Dockerfile .
docker compose up -d
docker compose exec termanch-server termanch-server --register
# Prints token + QR, server registers with app.termanch.dev
```

## Image Size Target
- `< 150MB` compressed
- Multi-stage build strips debug symbols
- Only runtime deps in final stage