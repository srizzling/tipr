# Infrastructure (OpenTofu)

Manages the GitHub repository settings and the Cloudflare Pages project. State is in a private R2 bucket
(`thisispodracing-tfstate`), never in git.

## First time on a machine
1. `CLOUDFLARE_SETUP_TOKEN=<broad token> node scripts/cloudflare-bootstrap.mjs --github` (from the repo root).
   It creates the state bucket, bucket-scoped keys and a Pages-only API token, writes `infra/.env` and `infra/backend.hcl`
   (both git-ignored), and stores the Pages token and account id as GitHub `production` secrets.
   The setup token needs "Account API Tokens: Edit" and "Workers R2 Storage: Edit" and is never stored here.
   On a second machine, run it again with `--rotate` to mint fresh keys.
2. Load the environment and initialise:
   ```sh
   set -a; . infra/.env; set +a
   export GITHUB_TOKEN=$(gh auth token) TF_VAR_cloudflare_account_id=$CLOUDFLARE_ACCOUNT_ID
   devenv shell -- tofu -chdir=infra init -backend-config=backend.hcl
   ```

## Day to day
```sh
devenv shell -- tofu -chdir=infra plan
devenv shell -- tofu -chdir=infra apply
```
`plan` always shows one harmless line for the Pages project, `+ build_image_auto_upgrade = (known after apply)`, a
provider quirk. Anything else is a real change.

## Notes
- Branch and tag rulesets are on (`enable_rulesets`); release PRs need an admin merge past the required checks.
- The Pages token has only "Pages Write". Add DNS permissions to it when a custom domain is set up.
- CI never applies infrastructure; it only runs `fmt` and `validate` (no credentials needed).
