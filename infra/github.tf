provider "github" {
  owner = var.github_owner
  # Reads GITHUB_TOKEN from the environment.
}

resource "github_repository" "repo" {
  name        = var.repository_name
  description = "This Is Pod Racing: Star Wars Galactic Racer build planner"
  visibility  = "public"

  has_issues   = true
  has_wiki     = false
  has_projects = false

  allow_squash_merge          = true
  allow_merge_commit          = false
  allow_rebase_merge          = false
  squash_merge_commit_title   = "PR_TITLE"
  squash_merge_commit_message = "PR_BODY"
  delete_branch_on_merge      = true

  security_and_analysis {
    secret_scanning {
      status = "enabled"
    }
    secret_scanning_push_protection {
      status = "enabled"
    }
  }
}

resource "github_repository_vulnerability_alerts" "repo" {
  repository = github_repository.repo.name
  enabled    = true
}

# Release Please opens its release PR with the workflow token, which GitHub only allows when this is on.
resource "github_workflow_repository_permissions" "repo" {
  repository                       = github_repository.repo.name
  default_workflow_permissions     = "read"
  can_approve_pull_request_reviews = true
}

resource "github_repository_dependabot_security_updates" "repo" {
  repository = github_repository.repo.name
  enabled    = true
}

# Release tags (v1.2.3) are what production deploys from, so nobody may move or delete them.
resource "github_repository_ruleset" "release_tags" {
  count       = var.enable_rulesets ? 1 : 0
  name        = "release-tags"
  repository  = github_repository.repo.name
  target      = "tag"
  enforcement = "active"

  conditions {
    ref_name {
      include = ["refs/tags/v*"]
      exclude = []
    }
  }

  rules {
    deletion         = true
    non_fast_forward = true
    update           = true
  }
}

resource "github_repository_ruleset" "main" {
  count       = var.enable_rulesets ? 1 : 0
  name        = "main"
  repository  = github_repository.repo.name
  target      = "branch"
  enforcement = "active"

  conditions {
    ref_name {
      include = ["~DEFAULT_BRANCH"]
      exclude = []
    }
  }

  rules {
    deletion                = true
    non_fast_forward        = true
    required_linear_history = true

    pull_request {
      required_approving_review_count = 0
      dismiss_stale_reviews_on_push   = true
    }

    required_status_checks {
      strict_required_status_checks_policy = true
      required_check {
        context = "pr-title"
      }
      required_check {
        context = "web"
      }
      required_check {
        context = "infra"
      }
      required_check {
        context = "audit"
      }
      required_check {
        context = "workflow-lint"
      }
      required_check {
        context = "codeql (javascript-typescript)"
      }
    }
  }
}

resource "github_repository_environment" "production" {
  repository  = github_repository.repo.name
  environment = "production"

  deployment_branch_policy {
    protected_branches     = true
    custom_branch_policies = false
  }
}
