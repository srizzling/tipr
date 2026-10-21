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
- [ ] Create the GitHub repo and enable Renovate, secret scanning and push protection
- [ ] Cloudflare API token and account id added as Actions secrets, first deploy to `*.pages.dev`
- [ ] Read the Games Lantern terms of use, then add data credit to the footer
- [ ] Verify unconfirmed data against the game (see "Data to verify")
- [ ] Original icons and fonts, no game art or Star Wars logos
- [ ] Accessibility pass (keyboard on the tuning boxes and pickers) and a Playwright smoke test

## v1.x: content and growth

- [ ] **Static reference pages:** one page per racer style, ability, part and status term, generated from the data. These are the search traffic.
- [x] `/b/<code>` is rendered on the server by a Cloudflare Pages Function (`functions/b/[code].ts`): real page title, Open Graph text previews, build content in the HTML, 404 for invalid codes, `noindex`
- [x] Link-preview images: 85 cards (one per vehicle class and racer style, plus a default) rendered at build time with resvg, served statically. The Function points each shared build at the matching card, so there is no runtime image cost
- [ ] Per-build preview image showing speed, abilities and parts (needs a paid Workers plan for the CPU time, or an external renderer)
- [ ] Donations link: set `DONATE_URL` in `src/site.ts` (and add `.github/FUNDING.yml`) once a platform is chosen
- [ ] Saved builds and a "garage" in localStorage
- [ ] "What should I buy next?" view showing the next Tuning Point box and its cost
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

- **IP:** Lucasfilm and Disney could object to a fan site with ads. Mitigations: no game art or logos, clear disclaimer, no use of "Star Wars" in the site name.
- **Data source:** the scraped database has no content licence. Facts and the game's own text are reusable in principle, but their terms need checking and the data can be rebuilt from saves and guides if needed.
- **Game updates:** patches will change numbers and add parts. Keep the scrape script re-runnable and show a data version on the site.
- **Cloud saves:** an edited or restored save can be re-synced by Steam. The importer only reads the file and never writes.
