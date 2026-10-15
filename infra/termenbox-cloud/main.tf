# Termenbox Cloud Infrastructure
# Manages ONLY our hosted services: Cloudflare Pages (client) and DNS.
# GitHub Actions secrets and variables are set by hand: the PAT cannot write them, and an apply with a missing
# value would overwrite the real secret.
# Does NOT manage user VPSes — users self-host server via Docker
# GitHub OAuth App is created MANUALLY (no admin:oauth_app scope exists for PATs)

terraform {
  required_version = ">= 1.6"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  backend "s3" {
    bucket         = "termenbox-terraform-state"
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

locals {
  pages_project_name = coalesce(var.pages_project_name, "termenbox")
  prefixed           = coalesce(var.pages_project_name, "") != ""
  dns_prefix         = local.prefixed ? "${var.pages_project_name}." : ""
  dns_name_prefix    = local.prefixed ? ".${var.pages_project_name}" : ""
  pages_subdomain    = "${local.pages_project_name}.pages.dev"
}

data "cloudflare_zone" "main" {
  name = var.cloudflare_zone_name
}

# Cloudflare Pages project for client hosting
resource "cloudflare_pages_project" "client" {
  account_id = var.cloudflare_account_id
  name       = local.pages_project_name
  production_branch = "master"

  # No build_config and no source: the client is built on GitHub (deploy-pages.yaml) and uploaded directly.
  # Cloudflare never builds this project. Do not connect it to Git in the dashboard.

  deployment_configs {
  }
}

# Custom domain for Pages
resource "cloudflare_pages_domain" "app" {
  account_id = var.cloudflare_account_id
  project_name = cloudflare_pages_project.client.name
  domain = "app.${local.dns_prefix}${var.cloudflare_zone_name}"
}

# DNS record for app subdomain (CNAME to Pages)
resource "cloudflare_record" "app" {
  zone_id = data.cloudflare_zone.main.id
  name    = "app${local.dns_name_prefix}"
  type    = "CNAME"
  content = local.pages_subdomain
  proxied = true
  ttl     = 1
}

output "client_url" {
  value = "https://app.${local.dns_prefix}${var.cloudflare_zone_name}"
}
