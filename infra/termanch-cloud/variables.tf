variable "cloudflare_api_token" {
  description = "Cloudflare API Token with Zone/Pages/DNS permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

variable "cloudflare_zone_name" {
  description = "Cloudflare zone (domain) for app.termanch.dev"
  type        = string
}

variable "cloudflare_pages_deploy_token" {
  description = "Cloudflare Pages deploy token (scoped to termanch project)"
  type        = string
  sensitive   = true
}

variable "github_token" {
  description = "GitHub token with repo/admin:oauth_app permissions"
  type        = string
  sensitive   = true
}

variable "github_repository" {
  description = "GitHub repository (owner/name)"
  type        = string
  default     = "sergemso/termanch"
}