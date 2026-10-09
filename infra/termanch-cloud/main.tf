# Termanch Cloud Infrastructure
# Manages ONLY our hosted services: Cloudflare Pages (client), DNS, GitHub Actions secrets
# Does NOT manage user VPSes — users self-host server via Docker
# GitHub OAuth App is created MANUALLY (no admin:oauth_app scope exists for PATs)

terraform {
  required_version = ">= 1.6"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }

  backend "s3" {
    bucket         = "termanch-terraform-state"
    key            = "cloud/terraform.tfstate"
    region         = "auto"
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

provider "github" {
  token = var.github_actions_token
}

data "cloudflare_zone" "main" {
  name = var.cloudflare_zone_name
}

# R2 bucket for Terraform state (must exist before backend init)
resource "cloudflare_r2_bucket" "terraform_state" {
  account_id = var.cloudflare_account_id
  name       = "termanch-terraform-state"
  location   = "WNAM"
}

# Cloudflare Pages project for client hosting
resource "cloudflare_pages_project" "client" {
  account_id = var.cloudflare_account_id
  name       = "termanch"
  production_branch = "master"

  build_config {
    build_command = "pnpm --filter termanch-client build"
    destination_dir = "packages/client/dist"
    root_dir = "/"
  }

  deployment_configs {
  }
}

# Custom domain for Pages
resource "cloudflare_pages_domain" "app" {
  account_id = var.cloudflare_account_id
  project_name = cloudflare_pages_project.client.name
  domain = "app.${var.cloudflare_zone_name}"
}

# DNS record for app subdomain (CNAME to Pages)
resource "cloudflare_record" "app" {
  zone_id = data.cloudflare_zone.main.id
  name    = "app"
  type    = "CNAME"
  content = "${cloudflare_pages_project.client.subdomain}.pages.dev"
  proxied = true
  ttl     = 1
}

# DNS record for API subdomain (if needed for OAuth callback proxy)
resource "cloudflare_record" "api" {
  zone_id = data.cloudflare_zone.main.id
  name    = "api"
  type    = "CNAME"
  content = "${cloudflare_pages_project.client.subdomain}.pages.dev"
  proxied = true
  ttl     = 1
}

# GitHub repository secret for CI (Cloudflare Pages deploy token)
resource "github_actions_secret" "cf_pages_token" {
  repository = var.github_repository
  secret_name = "CLOUDFLARE_API_TOKEN"
  plaintext_value = var.cloudflare_pages_deploy_token
}

resource "github_actions_secret" "cf_pages_account_id" {
  repository = var.github_repository
  secret_name = "CLOUDFLARE_ACCOUNT_ID"
  plaintext_value = var.cloudflare_account_id
}

# GitHub repository variable for client build (OAuth Client ID from manual setup)
resource "github_actions_variable" "oauth_client_id" {
  repository = var.github_repository
  variable_name = "TERMANCH_GITHUB_CLIENT_ID"
  value = var.github_oauth_client_id
}

output "client_url" {
  value = "https://app.${var.cloudflare_zone_name}"
}

output "oauth_client_id" {
  value = var.github_oauth_client_id
}

output "oauth_client_secret" {
  value     = var.github_oauth_client_secret
  sensitive = true
}