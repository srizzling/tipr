terraform {
  required_version = ">= 1.9"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }

  # State lives in a private Cloudflare R2 bucket (created by scripts/cloudflare-bootstrap.mjs). The account endpoint is in
  # backend.hcl and the bucket-scoped keys come from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in infra/.env, so run:
  #   tofu init -backend-config=backend.hcl
  # The skip_* settings are the ones Cloudflare documents for R2. No locking: one person applies at a time.
  backend "s3" {
    bucket                      = "thisispodracing-tfstate"
    key                         = "infra/terraform.tfstate"
    region                      = "auto"
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
    use_path_style              = true
  }
}
