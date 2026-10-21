# Roadmap

Status of **This Is Pod Racing (tipr)**, a build planner for Star Wars: Galactic Racer. Unofficial fan project.

Scope decisions so far: campaign builds only, client-side only (no backend), compare-only ranking, PC save files first, ads reserved but not live.

## v1 prototype (in progress)

- [x] Astro + React island, mobile-first, build-screen layout modelled on the in-game UI
- [x] Build model: Tuning Point boxes (14 max, 7 per stat, 163 points to max), speed maths, share-link encoding, unit tests
- [x] Game data schema (`src/data/types.ts`)
- [ ] Game data seeded from Games Lantern (4 classes, 20 styles, 45 abilities, ~318 parts, glossary)
- [x] Faults are optional per part (they happen during a run), and the picker groups all 59 by the system they affect
- [x] Drag-and-drop abilities: library to slot, slot to slot (swap), slot to library (clear); touch uses long-press
- [ ] Planner: class, racer style and rank, four ability slots plus crash slot, up to four parts, tuning boxes
- [ ] "All unlocked" and "My unlocks" modes (manual sliders for events completed and Tuning Points earned)
- [x] Share build by link: `/b/<code>` opens a read-only build page with an "Edit this build" button
- [ ] Podracer class and the six multiplayer-only podracer styles
- [ ] Reserved ad slot and "not affiliated" footer

## v1 remaining (before public launch)

- [x] **Compare view:** two builds side by side (from two links), with stat, ability and part diffs. This is the only "ranking" in v1.
- [ ] **Save-file import (PC):** client-side GVAS `.sav` parser that fills in events completed, unlocked styles and ranks, and Tuning Points earned. Needs sample saves (early and late) to find the property names. The file never leaves the browser.
- [ ] **Remote OpenTofu state** (R2 bucket) and first `tofu apply`
- [x] GitHub repo created (public) with secret scanning, push protection, Dependabot security updates, squash-merge only, and branch and tag rulesets, all through OpenTofu
- [ ] Install the Renovate GitHub App on the repo (GitHub only allows this in the browser: https://github.com/apps/renovate)
- [ ] Replace the admin PR bypass with a GitHub App token for Release Please, so its release PRs run the required checks
- [x] **First deploy: https://thisispodracing.pages.dev** (done by hand with `wrangler pages deploy`, using the wrangler login on the dev machine). `tipr.pages.dev` belongs to someone else, hence the project name.
- [ ] **Make deploys automatic and infrastructure-as-code.** Needs a Cloudflare API token (Pages edit) from the Cloudflare dashboard, then:
  1. `gh secret set CLOUDFLARE_API_TOKEN --env production` and `gh secret set CLOUDFLARE_ACCOUNT_ID --env production` (the account id is `db47ac5c1f1b7a9a4f1196afbb271aff`)
  2. bring the hand-made project under OpenTofu: `tofu -chdir=infra import -var cloudflare_account_id=db47ac5c1f1b7a9a4f1196afbb271aff cloudflare_pages_project.site db47ac5c1f1b7a9a4f1196afbb271aff/thisispodracing`
  3. merge the Release Please PR (v0.1.0); its deploy job then publishes from CI
- [ ] Read the Games Lantern terms of use, then add data credit to the footer
- [ ] Verify unconfirmed data against the game (see "Data to verify")
- [x] Restyled to follow the game's build screen: Rajdhani (open-licence) font, panel headings with rules, translucent rows, italic text with gold keywords, icon-led stat rows, Max Energy dots, `INSTALLED PARTS n/4`, red fault boxes, vehicle arrows, S/C/R key hints
- [x] **The game's own art, self-hosted** (your decision): 9 ability glyphs, 7 stat glyphs and 245 part cards, converted small by `scripts/fetch-icons.mjs` into `public/game/` (about 1 MB). Shown in the planner, pickers, shared pages and the share image. One switch, `USE_GAME_ART` in `src/lib/game-art.ts`, falls back to our original line icons everywhere
- [ ] Part icons: the game's build screen uses a small glyph per part, but only the large photo cards are on the data site, so parts show the card as a thumbnail instead
- [ ] Closer matches still missing: Aurebesh headings, the vehicle blueprint drawing, the blurred paper backdrop (we have not sourced these)
- [ ] Accessibility pass (keyboard on the tuning boxes and pickers) and a Playwright smoke test

## Performance (measured on the production build, local network)

| Page | First paint | Transfer | Notes |
|---|---|---|---|
| Planner `/` | 44 ms | 162 KB over 30 requests (was 210 KB) | about 118 KB JavaScript, no long tasks, layout shift 0.003 |
| Parts list `/parts/` | 36 ms | 168 KB over 46 requests (was 487 KB over 114) | thumbnails load only when near the screen |
| A reference page | 36 ms | about 4 KB over 6 requests | pure HTML and CSS |

`pnpm check:budget` fails CI if the planner's JavaScript passes 130 KB gzipped, a stylesheet passes 12 KB, or a page's HTML passes 20 KB.

## v1.x: content and growth

- [x] **Reference pages:** 446 static pages: a page per racer style (20), ability (45), part (259), fault (59) and keyword (55), with index pages, a site nav, cross-links from every keyword, "add to a build" buttons that open the planner pre-filled, `sitemap.xml` and `robots.txt`. A link checker (`pnpm check:links`) runs in CI
- [x] `/b/<code>` is rendered on the server by a Cloudflare Pages Function (`functions/b/[code].ts`): real page title, Open Graph text previews, build content in the HTML, 404 for invalid codes, `noindex`
- [x] Link-preview images: 85 cards (one per vehicle class and racer style, plus a default) rendered at build time with resvg, served statically. The Function points each shared build at the matching card, so there is no runtime image cost
- [x] **Build screen image:** a replica of the build screen with the real stats, parts and faults. *Copy image* and *Save image* draw it in the browser (free, works today); the same renderer feeds an optional per-build link preview
- [ ] Turn on per-build link previews: set `DYNAMIC_OG` to `"1"` in `wrangler.jsonc`. It needs Cloudflare's paid Workers plan, because drawing takes about 40 to 110 ms of CPU and the free plan allows 10 ms. Until then, previews use the static class and style card
- [x] **Build verdicts:** a funny title and roast for every build, written from what is in it (stat spread, faults, class, style, abilities), with a reroll button. Shown on the planner, shared pages, the share image and link-preview text. 17 rules, about 60 original jokes
- [ ] More jokes and community in-jokes: add rules as the community's running gags appear, and let people submit verdicts (needs a backend)
- [ ] Donations link: set `DONATE_URL` in `src/site.ts` (and add `.github/FUNDING.yml`) once a platform is chosen
- [x] **Garage:** save builds in this browser, rename, delete, open, compare and copy links on `/garage/`; the compare page can pick from it
- [x] Tuning hint under the stats: what the next box costs, points to max, and points left in My unlocks mode
- [x] Parts that need more events than you have completed are flagged in My unlocks mode
- [ ] Respec planner (2-point respec, spend plan for a given number of points)
- [ ] Privacy-friendly analytics (Cloudflare Web Analytics)
- [ ] Custom domain (OpenTofu already has the variables)
- [ ] **Ads:** apply to AdSense once there is content and traffic, and add a consent banner for the EU and UK first

## v2: multiplayer and tour planning

- [ ] **Multiplayer Tour mode:** fixed style loadouts per character and temporary credit-bought upgrades. Needs confirmation of what carries over from the campaign.
- [ ] **Tour credit planner:** budget credits across a tour (parts cost 2000 to 4000, ability installs 1000 to 4000, upgrade packs 1500, fault repairs 250)
- [ ] Console support through the manual "I've unlocked these" picker (consoles have no readable saves)
- [ ] Synergy tags (for example Burning, Slipstreaming, Surge) and a filter for builds built around one

## v3: community and ranking

- [ ] **Backend** (Cloudflare Workers and D1) and sign-in
- [ ] Publish builds, upvotes and "Best builds per style or class"
- [ ] Build comments and "fork this build"
- [ ] Moderation and abuse controls
- [ ] Leaderboards only if the game exposes verifiable results (it does not today)

## Data to verify

These are conflicts or gaps in the sources, so they are marked unverified in the data until a save file or the game confirms them.

- Rank 1 unlock conditions for each racer style (Games Lantern and Insider Gaming disagree)
- Tuning Points awarded per Scenario, Galactic Gauntlet and Championship Race, and whether the +1 for a race needs a top-three finish
- Whether "15" is the vehicle level cap (14 purchasable boxes) or a separate limit
- Whether campaign Tuning Points have any effect in multiplayer (the developers say upgrade perks match, but progression is separate)
- Number of part slots (sources say 4) and ability slots (sources say up to 5)
- Cost of unlocking the Speeder Bike and Skim Speeder (10 and 20 Tuning Points are reported)
- Red downside text for every Fault part
- Save file format and property names

## Risks

- **IP:** Lucasfilm and Disney could object to a fan site with ads, and the site now shows the game's artwork (ability and stat glyphs, part cards). Mitigations: a clear disclaimer and credit in the footer, `public/game/NOTICE.md`, a takedown route, all game art in one folder, and the `USE_GAME_ART` switch that removes it in one change. AdSense reviews can also reject sites that rely on copyrighted images, so be ready to flip the switch before applying.
- **Data source:** the scraped database has no content licence. Facts and the game's own text are reusable in principle, but their terms need checking and the data can be rebuilt from saves and guides if needed.
- **Game updates:** patches will change numbers and add parts. Keep the scrape script re-runnable and show a data version on the site.
- **Cloud saves:** an edited or restored save can be re-synced by Steam. The importer only reads the file and never writes.
