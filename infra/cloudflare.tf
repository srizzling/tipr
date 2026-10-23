provider "cloudflare" {
  # Reads CLOUDFLARE_API_TOKEN from the environment.
}

resource "cloudflare_pages_project" "site" {
  account_id        = var.cloudflare_account_id
  name              = var.pages_project_name
  production_branch = var.production_branch

  # Provider quirk (cloudflare v5.28): `tofu plan` always lists "+ build_image_auto_upgrade = (known after apply)" here,
  # a computed field it cannot ignore. It is harmless; anything beyond that one line is a real change.
}

# The builds board (functions/api/builds). Tables come from ../migrations, applied by the release workflow or `pnpm db:remote`.
# The Pages binding itself lives in wrangler.jsonc (it is the source of truth for the Pages project), so paste this id there.
resource "cloudflare_d1_database" "builds" {
  account_id = var.cloudflare_account_id
  name       = "thisispodracing-builds"
}

output "builds_database_id" {
  description = "Goes in wrangler.jsonc as d1_databases[0].database_id."
  value       = cloudflare_d1_database.builds.id
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
