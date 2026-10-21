variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account that owns the Pages project."
}

variable "github_owner" {
  type        = string
  description = "GitHub user or org that owns the repository."
  default     = "srizzling"
}

variable "repository_name" {
  type    = string
  default = "tipr"
}

variable "production_branch" {
  type    = string
  default = "main"
}

variable "domain" {
  type        = string
  description = "Apex domain for the site, e.g. example.gg. Leave empty to use the *.pages.dev address only."
  default     = ""
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Zone id for var.domain. Required when domain is set."
  default     = ""
}

variable "enable_rulesets" {
  type        = bool
  description = "Apply the branch and tag rulesets. Leave false for the very first push and merge (they require checks that have not run yet), then set true."
  default     = false
}
