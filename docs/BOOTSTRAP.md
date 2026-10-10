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
2. **No manual DNS needed** — Terraform creates `app.{zone}` / `api.{zone}` (or `app.{project}.{zone}` / `api.{project}.{zone}` if `pages_project_name` is set) automatically

### 1.2 Create Cloudflare API Token
1. Go to **My Profile → API Tokens → Create Token**
2. Use **Custom token** template:
   - **Permissions**:
     - Account → Cloudflare Pages → Edit
     - Account → R2 → Edit
     - Zone → DNS → Edit
     - Zone → Zone → Read
   - **Account Resources**: Include your account
   - **Zone Resources**: Include your zone (`yourdomain.com`)
3. Save as `CLOUDFLARE_API_TOKEN`

### 1.2.1 Create R2 API Token (for Terraform state backend)
1. Go to **R2 → Manage R2 API tokens → Create API token**
2. **Permissions**: Object Read & Write (or Edit)
3. **Account Resources**: Include your account
4. Save **Access Key ID** as `R2_ACCESS_KEY_ID`
5. Save **Secret Access Key** as `R2_SECRET_ACCESS_KEY`

> **Note**: The main `CLOUDFLARE_API_TOKEN` (step 1.2) also needs **Account → R2 → Edit** permission to create the R2 bucket via Terraform. The R2 API token (step 1.2.1) is only used by Terraform's S3 backend for state storage.

### 1.3 Create GitHub Personal Access Tokens

You need **two tokens** for different purposes:

**A. Fine-grained PAT (for GitHub Actions secrets/variables via Terraform):**
1. Go to **GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. **Repository access**: `sergemso/termanch` (or your fork)
3. **Permissions**:
   - Repository → Actions → Read/Write (for secrets/variables)
   - Repository → Administration → Read/Write (for repo settings)
   - Repository → Variables → Read/Write
3. Save as `TERMANCH_GITHUB_ACTIONS_TOKEN` — used as `github_actions_token` in Terraform (set as secret `TERMANCH_GITHUB_ACTIONS_TOKEN` in GitHub repo)

**B. Classic PAT (for GitHub CLI / manual API calls only):**
1. Go to **GitHub Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic)**
2. **Scopes**: `repo`, `admin:org` (for org-level operations if needed)
3. Save as `GITHUB_CLASSIC_TOKEN` — used for `gh` CLI and manual API calls

> **Note**: There is NO `admin:oauth_app` scope in GitHub tokens. GitHub OAuth Apps must be created manually (see step 1.4).

### 1.4 Create GitHub OAuth App (Manual — One-time)
1. Go to **GitHub Settings → Developer settings → OAuth Apps → New OAuth App**
2. Fill in:
   - **Application name**: `Termanch` (or your preferred name)
   - **Homepage URL**: `https://app.${your_zone_name}` (or `https://app.${project}.${your_zone_name}` if using `pages_project_name`)
   - **Authorization callback URL**: `https://app.${your_zone_name}/callback` (or `https://app.${project}.${your_zone_name}/callback`)
3. Click **Register application**
4. **Generate a new client secret**
5. Save both **Client ID** and **Client Secret** — you'll need them for Terraform

> **Note**: Use the actual domain from Terraform output `client_url` after running `terraform apply`. You can update the OAuth App later if needed.

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
cloudflare_api_token         = "your-cf-api-token"
cloudflare_account_id        = "your-cf-account-id"
cloudflare_zone_name         = "yourdomain.com"
cloudflare_pages_deploy_token = "your-pages-deploy-token"
github_actions_token         = "your-fine-grained-pat"
github_oauth_client_id       = "your-github-oauth-client-id"
github_oauth_client_secret   = "your-github-oauth-client-secret"
github_repository            = "sergemso/termanch"
# Optional: Pages project name (enables app.{project}.{zone} / api.{project}.{zone})
# pages_project_name = "myapp"
# R2 backend credentials (for Terraform state)
r2_access_key_id     = "your-r2-access-key-id"
r2_secret_access_key = "your-r2-secret-access-key"
EOF

# Initialize and apply (creates everything below)
terraform init
terraform plan
terraform apply
```

**Terraform creates automatically:**
- ✅ Cloudflare Pages project (`termanch` by default, or `pages_project_name` if set)
- ✅ Custom domain: `app.{zone}` (default) or `app.{project}.{zone}` (if `pages_project_name` set)
- ✅ DNS records: `app.{zone}` / `api.{zone}` (default) or `app.{project}.{zone}` / `api.{project}.{zone}`
- ✅ GitHub Actions secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
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
- `client_url` — your client URL (e.g., `https://app.yourdomain.com` or `https://app.myapp.yourdomain.com`)

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

Scan the QR code with the Termanch app at the Terraform output `client_url`

---

## 5. Verify End-to-End

1. Open the Terraform output `client_url` (e.g., `https://app.yourdomain.com` or `https://app.myapp.yourdomain.com`)
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