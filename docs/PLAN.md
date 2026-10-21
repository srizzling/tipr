# Plan

How we get from the prototype to a launched site. `ROADMAP.md` lists features by stage; this file says what to do next, in what order, and how we know each step is done.

## Where we are

- Astro site with one React island: the planner (`/`) and a read-only shared build page (`/b/<code>`).
- Game data scraped from Games Lantern into `src/data/*.json`: 4 classes, 20 styles, 45 abilities, 318 parts (59 Faults), 55 keywords.
- Build model in `src/lib/build.ts`: Tuning Point costs, limits, speed, share-link encoding, unit tests.
- Config written but never run against GitHub or Cloudflare: Renovate, Release Please, CI, and OpenTofu for Cloudflare Pages and the GitHub repo.
- Not started: compare view, save-file import, scraper hardening, link previews, reference pages.

## Decisions already made

| Topic | Decision |
|---|---|
| Name | This Is Pod Racing, short name tipr |
| Framework | Astro with a React island, static output |
| Scope | Campaign builds only. Multiplayer Tour comes later |
| Platform | Mobile-first, three-column layout on desktop |
| Backend | None in v1. Builds live in the share link |
| Ranking | Compare-only in v1. Upvotes later, with a backend |
| Saves | PC saves first, parsed in the browser. Other platforms use the manual picker |
| Art | Own icons and fonts. No game art or Star Wars logos |
| Ads | Reserved slot only until there is content and traffic |
| Data | Scrape once from Games Lantern, commit the JSON, credit them, check their terms before launch |
| Infrastructure | OpenTofu for Cloudflare Pages and the GitHub repo. State in R2. `*.pages.dev` until a domain is chosen |
| Releases | Release Please with conventional commits. PR titles are checked. Deploy runs only when a release is cut |

## Milestone 0: first commit and a look

Goal: the work is in git and you have seen it.

1. Commit the prototype in logical commits (devenv, data, planner, CI and infrastructure, docs).
2. You run `pnpm dev` and try the planner and a shared link.
3. Collect your notes on layout, wording and missing things before more is built.

Done when: you have seen it and the notes are written down here or in issues.

## Milestone 1: finish the v1 features

### 1a. Compare view (done)
- New page `/compare?a=<code>&b=<code>`. Either side can be a build link, "my current build" or empty.
- Side-by-side columns that reuse the read-only build panels.
- A diff strip: speed, level, Tuning Points spent, boxes per stat, and parts, abilities and traits that appear on one side only.
- A "Compare with…" button on the shared build page and in the planner.
- Tests for the diff function in `src/lib/compare.ts`.

Done when: two links open side by side on a phone and a desktop, and every difference is highlighted.

### 1b. Scraper hardening (done, except the weekly Action)
- `--refresh` flag that ignores the cache (`pnpm data:refresh`), and `--check` for a diff-only run (`pnpm data:check`).
- `src/data/data-meta.json` with source URL, page hashes and the scrape date. The site shows a data version from it.
- Fail the build if counts drop (fewer than 300 parts, 20 styles, 45 abilities) or required fields are empty.
- A weekly GitHub Action runs the scrape and opens a PR with the JSON diff. It needs a Firecrawl key as an Actions secret.

Done when: a second run on an unchanged site produces an identical diff, and a deliberately broken page makes the run fail without overwriting data.

### 1c. Save-file import (needs your sample saves)
You supply two `.sav` files from `%LOCALAPPDATA%\StarWarsGalacticRacer\Saved\SaveGames\<SteamID>\`: one early and one late (or before and after one change).
1. Run a GVAS parser over both (for example `uesave`) and diff the JSON to find the property names for events completed, racer style ranks and progress, Tuning Points per vehicle, and unlocked parts.
2. Write `src/lib/save.ts`: a browser-only parser that turns a file into an `Unlocks` object (events completed, styles and ranks, Tuning Points earned and spent per vehicle, unlocked parts).
3. Replace the two sliders in "My unlocks" with an upload box, and keep the sliders as the manual fallback.
4. Tests against small fixtures that contain no personal data.
5. Show clearly that the file never leaves the browser.

Done when: dropping a real save fills in "My unlocks" and the numbers match the in-game screen. If the file is encrypted or the format is not GVAS, we fall back to the manual picker and note it in the roadmap.

### 1d. Polish before launch
- Replace text labels with original stat and ability icons.
- Keyboard and screen-reader pass for the tuning boxes, pickers and the share button.
- Flag installed parts that "My unlocks" says you haven't unlocked.
- Playwright smoke tests: open the planner, build something, share it, open the shared page.
- Unverified-data badges for entries listed under "Data to verify" in `ROADMAP.md`.

## Milestone 2: bring up the infrastructure

This part needs you, because it creates public things and uses your accounts.

1. Create the R2 bucket for OpenTofu state by hand, and add the `backend "s3"` block to `infra/versions.tf`.
2. Create a Cloudflare API token (Pages edit, plus DNS edit when a domain is added). Store it with `request_secret`, never in chat or git.
3. `tofu apply` for the GitHub repo (public, secret scanning, push protection, `main` ruleset, `production` environment).
4. Push the code. Install the Renovate GitHub App on the repo.
5. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as secrets in the `production` environment.
6. `tofu apply` for the Cloudflare Pages project.
7. Merge a `feat:` PR. Release Please opens a release PR. Merging it creates `v0.1.0` and deploys.

Done when: the site is live on `*.pages.dev`, `/b/<code>` links open, and a new Renovate PR appears.

Risks: the `~DEFAULT_BRANCH` ruleset can block the first push. If so, push before applying the ruleset. The Pages rewrite for `/b/*` has only been tested in the dev server, so test it on the real host.

## Milestone 3: launch checks

- Read the Games Lantern terms of use. If they forbid reuse, rebuild the data from guides and saves before launch.
- Credit the data source and keep the "not affiliated" notice in the footer.
- Choose and register a domain, then set `domain` and `cloudflare_zone_id` in OpenTofu.
- Add privacy-friendly analytics (Cloudflare Web Analytics).
- Check the site against the Lucasfilm and Disney risk list in `ROADMAP.md`.
- Add a short "How to find your save file" page for PC players.

## Milestone 4: growth (v1.x)

1. **Reference pages** generated from the data: one page per racer style, ability, part and status term. Each links to a prefilled planner. This is the search traffic, so write real titles, descriptions and internal links.
2. **Link previews:** a Cloudflare Pages Function for `/b/*` that renders an Open Graph image and title from the code.
3. **Saved builds:** a garage in localStorage with names and notes.
4. **What to buy next:** the next Tuning Point box and its cost, and a respec planner.
5. **Ads:** apply to AdSense once there is traffic. Add a consent banner for EU and UK visitors first. Place ads outside the build screen.

## Milestone 5: multiplayer and tour planning (v2)

- Confirm in the game what carries over between campaign and multiplayer.
- Multiplayer Tour mode with fixed per-character style loadouts.
- Tour credit planner (part prices, ability installs, upgrade packs, fault repairs).
- Synergy tags such as Burning, Slipstreaming and Surge, with a filter.

## Milestone 6: community (v3)

- Backend on Cloudflare Workers and D1, with sign-in.
- Publish builds, upvotes, and "best builds per style or class".
- Comments, "fork this build", and basic moderation.

## Open questions

1. Is Games Lantern's data free to reuse? (Milestone 3)
2. What do the real save files contain, and are they readable? (1c)
3. Which domain? (Milestone 3)
4. Do you want the repo folder renamed from `racergalaticbuilds-gg` to `tipr`? The symlink in `~/.t3/projects` would need updating, and so would this thread.
5. Which ranking approach do we move to after compare-only: upvotes, curated lists, or both?

## Working rules

- Conventional commits through the `g<type>` fish functions. Subject lines stay under 50 characters including type, scope and emoji.
- All environment tooling lives in `devenv.nix`. No global installs.
- Infrastructure changes go through OpenTofu, never the Cloudflare or GitHub dashboards.
- Nothing is pushed or applied without your go-ahead.
