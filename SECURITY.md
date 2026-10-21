# Security policy

## Reporting a vulnerability

Please report security problems privately through GitHub's
["Report a vulnerability"](../../security/advisories/new) form on this repository. Do not open a public issue.

Include what you found, how to reproduce it, and the impact you expect. You will get a reply within a few days.

## Scope

This is a static site plus one Cloudflare Pages Function (`functions/b/[code].ts`) that renders shared build links.
It has no accounts, no database and stores no personal data. Save files are read in the browser and never uploaded.

In scope: the site, the Function, the build and release pipeline, and the infrastructure code in `infra/`.
Out of scope: Star Wars: Galactic Racer itself, and third-party services such as Cloudflare and GitHub.

## What is already in place

- GitHub secret scanning and push protection, enforced through `infra/github.tf`
- CodeQL, dependency review, `pnpm audit` and workflow linting on every pull request
- GitHub Actions pinned to commit SHAs, with least-privilege workflow permissions
- Renovate for dependency updates, with a release-age delay on new package versions
- A protected `main` branch and protected release tags
- A Content Security Policy, HSTS and other response headers (`src/lib/security-headers.ts`)
- Strict validation of share-link codes before they are parsed or rendered
