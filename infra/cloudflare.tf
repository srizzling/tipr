provider "cloudflare" {
  # Reads CLOUDFLARE_API_TOKEN from the environment.
}

resource "cloudflare_pages_project" "site" {
  account_id        = var.cloudflare_account_id
  name              = "tipr"
  production_branch = var.production_branch
}

resource "cloudflare_pages_domain" "site" {
  count        = var.domain == "" ? 0 : 1
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.site.name
  name         = var.domain
}

resource "cloudflare_dns_record" "site" {
  count   = var.domain == "" ? 0 : 1
  zone_id = var.cloudflare_zone_id
  name    = var.domain
  type    = "CNAME"
  content = cloudflare_pages_project.site.subdomain
  ttl     = 1
  proxied = true
}
