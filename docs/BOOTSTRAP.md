# Termanch Bootstrap Guide

This guide walks through setting up the cloud infrastructure (Cloudflare + GitHub OAuth) required to run Termanch.

## Prerequisites

- GitHub account
- Cloudflare account (free tier works)
- A domain managed by Cloudflare (e.g., `yourdomain.com`)
- Local machine with `git`, `docker`, `docker compose`

---

## 1. GitHub OAuth App

Create a GitHub OAuth App for authentication:

1. Go to **GitHub Settings → Developer settings → OAuth Apps → New OAuth App**
2. Fill in:
   - **Application name**: `Termanch` (or your preferred name)
   - **Homepage URL**: `https://app.yourdomain.com`
   - **Authorization callback URL**: `https://app.yourdomain.com/callback`
3. Click **Register application**
4. **Generate a new client secret**
4. Save both **Client ID** and **Client Secret** — you'll need them for the server config

> **Note**: For personal use, you can use GitHub's "Internal" mode (up to 100 users) without verification.

---

## 2. Cloudflare Setup

### 2.1 Add Domain to Cloudflare

1. Add your domain to Cloudflare (if not already)
2. Ensure DNS is proxied (orange cloud) for `app.yourdomain.com`

### 2.2 Create Cloudflare Pages Project

1. Go to **Cloudflare Dashboard → Workers & Pages → Create application → Pages → Connect to Git**
2. Select your GitHub repo (`sergemso/termanch`)
3. Configure build:
   - **Project name**: `termanch`
   - **Production branch**: `master`
   - **Build command**: `pnpm --filter termanch-client build`
   - **Build output directory**: `packages/client/dist`
   - **Root directory**: `/`
4. Add environment variable:
   - `VITE_GITHUB_CLIENT_ID` = your GitHub OAuth Client ID
5. Deploy — Cloudflare will give you `termanch.pages.dev` URL

### 2.3 Add Custom Domain

1. In Pages project → **Custom domains → Add custom domain**
2. Enter `app.yourdomain.com`
3. Cloudflare will auto-create DNS records (CNAME to `termanch.pages.dev`)

### 2.4 Create Cloudflare API Token

1. Go to **My Profile → API Tokens → Create Token**
2. Use **Custom token** template:
   - **Permissions**:
     - Account → Cloudflare Pages → Edit
     - Zone → DNS → Edit
     - Zone → Zone → Read
   - **Account Resources**: Include your account
   - **Zone Resources**: Include your zone (`yourdomain.com`)
3. Save the token — you'll need it for Terraform/bootstrap

---

## 3. Generate Secrets

Run these locally to generate secure secrets:

```bash
# JWT signing secret (32+ chars)
JWT_SECRET=$(openssl rand -base64 32)

# Registration HMAC secret (32+ chars)
REGISTRATION_SECRET=$(openssl rand -base64 32)

echo "JWT_SECRET=$JWT_SECRET"
echo "REGISTRATION_SECRET=$REGISTRATION_SECRET"
```

Save these — you'll need them for the server `.env` file.

---

## 4. Server Deployment (Your VPS)

### 4.1 On Your VPS

```bash
# SSH into your VPS (Ubuntu 22.04+ recommended)
ssh root@your-vps-ip

# Install Docker
curl -fsSL https://get.docker.com | sh

# Clone the repo
git clone https://github.com/sergemso/termanch.git
cd termanch/docker

# Create .env file
cat > .env <<EOF
TERMANCH_GITHUB_CLIENT_ID=your-github-client-id
TERMANCH_GITHUB_CLIENT_SECRET=your-github-client-secret
TERMANCH_JWT_SECRET=your-jwt-secret
TERMANCH_REGISTRATION_SECRET=your-registration-secret
TERMANCH_SERVER_NAME=my-vps
# For quick testing (ephemeral URL):
# CLOUDFLARE_TUNNEL_TOKEN=
# For production (named tunnel):
# CLOUDFLARE_TUNNEL_TOKEN=your-cloudflare-tunnel-token
EOF

# Start services
docker compose up -d

# Verify
docker compose ps
docker compose logs -f termanch-server
```

### 4.2 Register Server with Termanch

**Option A: Quick tunnel (trycloudflare) — no Cloudflare account needed**
```bash
# Already configured in docker-compose.yml (default)
docker compose up -d
```

**Option B: Named tunnel (persistent, custom domain) — requires Cloudflare account**
1. In Cloudflare Dashboard → **Zero Trust → Networks → Tunnels → Create tunnel**
2. Name it (e.g., `termanch`)
3. Configure ingress: `yourdomain.com` → `http://localhost:8080`
4. Copy the tunnel token
4. Add to `.env`: `CLOUDFLARE_TUNNEL_TOKEN=your-token`
5. `docker compose up -d`

### 4.3 Get Registration QR Code

```bash
docker compose exec termanch-server termanch-server --register
```

Output shows:
- Registration Token
- HMAC Token (for QR)
- Server Name

Scan the QR code with the Termanch app at `https://app.yourdomain.com`

---

## 5. Verify End-to-End

1. Open `https://app.yourdomain.com`
2. Click **"Login with GitHub"** → authorize
3. Click **"Add Server"** → scan QR code from step 4.3
4. Server appears in list → click to connect
5. Terminal opens → type `ls` → works!

---

## 6. Terraform (Optional: Infrastructure as Code)

If you want to manage cloud infra via Terraform:

```bash
cd infra/termanch-cloud

# Create terraform.tfvars
cat > terraform.tfvars <<EOF
cloudflare_api_token = "your-cf-api-token"
cloudflare_account_id = "your-account-id"
cloudflare_zone_name = "yourdomain.com"
cloudflare_pages_deploy_token = "your-pages-deploy-token"
github_token = "your-github-token"
github_repository = "sergemso/termanch"
EOF

# Initialize and apply
terraform init
terraform plan
terraform apply
```

This creates:
- Cloudflare Pages project
- Custom domain `app.yourdomain.com`
- GitHub OAuth App
- GitHub Actions secrets/variables

---

## 7. Bootstrap Script (Future)

A one-command bootstrap is planned:

```bash
curl -fsSL https://get.termanch.dev | bash
```

This will:
1. Install Docker + cloudflared
2. Generate secrets
3. Write docker-compose.yml + .env
4. Start services
5. Print QR code for registration

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `403 Forbidden` on Cloudflare Pages | Check `VITE_GITHUB_CLIENT_ID` env var is set correctly |
| WebSocket connection fails | Verify CORS headers on server; check cloudflared logs |
| QR code not scanning | Ensure HMAC token matches; check server time sync |
| `docker compose up` fails | Check `.env` has all required vars; `docker compose config` to validate |

---

## Security Notes

- All secrets stored in `.env` (chmod 600)
- JWT tokens expire in 7 days
- Registration tokens single-use, 10-min expiry
- TLS terminated at Cloudflare edge
- No secrets in logs or Docker images