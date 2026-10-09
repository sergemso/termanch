# Termanch Bootstrap Guide

This guide walks through setting up the cloud infrastructure (Cloudflare + GitHub OAuth) required to run Termanch.

**TL;DR** — Most cloud infra is automated via Terraform. You only need to:
1. Add your domain to Cloudflare
2. Create API tokens (Cloudflare + GitHub)
3. **Create GitHub OAuth App manually** (one-time)
4. Generate secrets
5. Run `terraform apply`
5. Deploy server to your VPS

---

## Prerequisites

- GitHub account
- Cloudflare account (free tier works)
- A domain managed by Cloudflare (e.g., `yourdomain.com`)
- Local machine with `git`, `docker`, `docker compose`, `terraform`

---

## 1. Prerequisites (One-time Setup)

### 1.1 Add Domain to Cloudflare
1. Add your domain to Cloudflare (if not already)
2. Ensure DNS is proxied (orange cloud) for `app.yourdomain.com`

### 1.2 Create Cloudflare API Token
1. Go to **My Profile → API Tokens → Create Token**
2. Use **Custom token** template:
   - **Permissions**:
     - Account → Cloudflare Pages → Edit
     - Zone → DNS → Edit
     - Zone → Zone → Read
   - **Account Resources**: Include your account
   - **Zone Resources**: Include your zone (`yourdomain.com`)
3. Save as `CLOUDFLARE_API_TOKEN`

### 1.3 Create GitHub Personal Access Tokens

You need **two tokens** for different purposes:

**A. Fine-grained PAT (for GitHub Actions secrets/variables):**
1. Go to **GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. **Repository access**: `sergemso/termanch` (or your fork)
3. **Permissions**:
   - Repository → Actions → Read/Write (for secrets/variables)
   - Repository → Administration → Read/Write (for repo settings)
   - Repository → Variables → Read/Write
3. Save as `GITHUB_ACTIONS_TOKEN`

**B. Classic PAT (for GitHub CLI / manual API calls):**
1. Go to **GitHub Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic)**
2. **Scopes**: `repo`, `admin:org` (for org-level operations if needed)
3. Save as `GITHUB_CLASSIC_TOKEN`

> **Note**: There is NO `admin:oauth_app` scope in GitHub tokens. GitHub OAuth Apps must be created manually (see step 1.5).

### 1.4 Create GitHub OAuth App (Manual — One-time)
1. Go to **GitHub Settings → Developer settings → OAuth Apps → New OAuth App**
2. Fill in:
   - **Application name**: `Termanch` (or your preferred name)
   - **Homepage URL**: `https://app.yourdomain.com`
   - **Authorization callback URL**: `https://app.yourdomain.com/callback`
3. Click **Register application**
4. **Generate a new client secret**
5. Save both **Client ID** and **Client Secret** — you'll need them for Terraform

### 1.5 Cloudflare Pages Deploy Token
1. Go to **Cloudflare Dashboard → Workers & Pages → Create token** (or use existing)
2. **Permissions**: Account → Cloudflare Pages → Edit
3. **Account Resources**: Include your account
3. Save as `CLOUDFLARE_PAGES_DEPLOY_TOKEN`

---

## 2. Run Terraform (Automates Everything Else)

```bash
cd infra/termanch-cloud

# Create terraform.tfvars
cat > terraform.tfvars <<EOF
cloudflare_api_token        = "your-cf-api-token"
cloudflare_account_id       = "your-cf-account-id"
cloudflare_zone_name        = "yourdomain.com"
cloudflare_pages_deploy_token = "your-pages-deploy-token"
github_actions_token        = "your-fine-grained-pat"
github_repository           = "sergemso/termanch"
EOF

# Initialize and apply (creates everything below)
terraform init
terraform plan
terraform apply
```

**Terraform creates automatically:**
- ✅ Cloudflare Pages project (`termanch`) with `master` branch
- ✅ Custom domain `app.yourdomain.com` (CNAME to Pages)
- ✅ DNS records: `app.yourdomain.com` → Pages, `api.yourdomain.com` → Pages
- ✅ GitHub Actions secrets: `CF_PAGES_API_TOKEN`, `CF_PAGES_ACCOUNT_ID`
- ✅ GitHub Actions variable: `TERMANCH_GITHUB_CLIENT_ID` (from Terraform input)

**You provide manually (from step 1.5):**
- `oauth_client_id` (GitHub OAuth App Client ID)
- `oauth_client_secret` (GitHub OAuth App Client Secret)

---

## 3. Generate Server Secrets

Run locally:

```bash
# JWT signing secret (32+ chars)
JWT_SECRET=$(openssl rand -base64 32)

# Registration HMAC secret (32+ chars)
REGISTRATION_SECRET=$(openssl rand -base64 32)

echo "JWT_SECRET=$JWT_SECRET"
echo "REGISTRATION_SECRET=$REGISTRATION_SECRET"
```

Save these for the server `.env` file.

**Terraform outputs:**
- `client_url` — your `https://app.yourdomain.com`

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
```

### 4.2 Create `.env` File

```bash
cat > .env <<EOF
TERMANCH_GITHUB_CLIENT_ID=<terraform output oauth_client_id>
TERMANCH_GITHUB_CLIENT_SECRET=<terraform output oauth_client_secret>
TERMANCH_JWT_SECRET=<your-jwt-secret>
TERMANCH_REGISTRATION_SECRET=<your-reg-secret>
TERMANCH_SERVER_NAME=my-vps
# For quick testing (ephemeral URL):
# CLOUDFLARE_TUNNEL_TOKEN=
# For production (named tunnel):
# CLOUDFLARE_TUNNEL_TOKEN=your-cloudflare-tunnel-token
EOF
```

### 4.3 Start Services

```bash
docker compose up -d

# Verify
docker compose ps
docker compose logs -f termanch-server
```

### 4.4 Get Registration QR Code

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

1. Open `https://app.yourdomain.com` (Terraform output `client_url`)
2. Click **"Login with GitHub"** → authorize
3. Click **"Add Server"** → scan QR code from step 4.3
4. Server appears in list → click to connect
5. Terminal opens → type `ls` → works!

---

## 6. CI/CD (Automated)

**On push to `master`:**
- CI runs: `cargo fmt`, `clippy`, `build`, `test` + `pnpm build/test`
- Docker image built + pushed to GHCR (multi-arch)
- Client deployed to Cloudflare Pages via `cloudflare/pages-action`

**Manual Terraform:**
```bash
gh workflow run deploy-infra.yaml -f action=plan -f environment=cloud
gh workflow run deploy-infra.yaml -f action=apply -f environment=cloud
```

---

## 7. Bootstrap Script (Future)

```bash
curl -fsSL https://get.termanch.dev | bash
```

Will automate: Docker install, secret generation, docker-compose, QR code.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `403 Forbidden` on Cloudflare Pages | Check `VITE_GITHUB_CLIENT_ID` GitHub Actions variable |
| WebSocket connection fails | Verify CORS headers on server; check cloudflared logs |
| QR code not scanning | Ensure HMAC token matches; check server time sync |
| `docker compose up` fails | Check `.env` has all required vars; `docker compose config` to validate |
| Terraform apply fails | Check API token permissions; verify domain is on Cloudflare |

---

## Security Notes

- All secrets in `.env` (chmod 600) / GitHub Actions secrets
- JWT tokens expire in 7 days
- Registration tokens single-use, 10-min expiry
- TLS terminated at Cloudflare edge
- No secrets in logs or Docker images
- GitHub OAuth App created manually (source of truth)