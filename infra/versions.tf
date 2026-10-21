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

  # State holds resource ids and must not live in git. Pick a remote backend before the first apply,
  # e.g. an R2 bucket via the s3 backend or HCP Terraform. Until then state is local and gitignored.
}
