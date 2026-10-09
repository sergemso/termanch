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

variable "github_actions_token" {
  description = "GitHub fine-grained PAT with Actions/Variables/Admin permissions"
  type        = string
  sensitive   = true
}

variable "github_oauth_client_id" {
  description = "GitHub OAuth App Client ID (created manually)"
  type        = string
}

variable "github_oauth_client_secret" {
  description = "GitHub OAuth App Client Secret (created manually)"
  type        = string
  sensitive   = true
}

variable "github_repository" {
  description = "GitHub repository (owner/name)"
  type        = string
  default     = "sergemso/termanch"
}

variable "r2_access_key_id" {
  description = "R2 Access Key ID for Terraform state backend"
  type        = string
  sensitive   = true
}

variable "r2_secret_access_key" {
  description = "R2 Secret Access Key for Terraform state backend"
  type        = string
  sensitive   = true
}