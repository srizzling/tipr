#!/usr/bin/env node
// Scrapes game data from https://galacticracer.gameslantern.com into src/data/*.json (+ data-meta.json).
//
// Usage (no package.json needed; plain `node` from PATH or `devenv shell -- node`):
//   node scripts/scrape-data.mjs fetch [cacheDir] [--refresh]  # download raw markdown pages via the firecrawl CLI
//   node scripts/scrape-data.mjs build [cacheDir]               # parse cached pages -> validate -> write src/data/*.json
//   node scripts/scrape-data.mjs build --check [cacheDir]       # CI: build in memory, validate, exit 1 if files on disk differ; writes nothing
//   node scripts/scrape-data.mjs all   [cacheDir] [--refresh]   # fetch then build (default mode)
//
//   --refresh   ignore the cache and re-download every page (default: only missing pages are fetched).
//               Each page is downloaded to a .part file and renamed on success, so a failed refresh keeps the old copy.
//   --check     no files are written. Exit code 1 if validation fails or any output file would change.
//               (`--check` on its own means `build --check`.)
//
// Safety: `build` validates everything in memory first (counts, non-empty names/text, costs, null allow-lists,
// <=5% id loss vs the files currently on disk) and only then writes, via temp files + rename. On any failure it exits
// non-zero and src/data is left untouched.
// data-meta.json: scrapedAt comes from the cache's .scraped-at stamp (written by fetch, not now()), so rebuilding from the same cache is byte-identical.
//
// Requirements: the `firecrawl` CLI (authenticated), because the site is behind Cloudflare and
// plain curl gets a 403. The page list comes from /sitemap.xml (scraped through firecrawl).
// The cache dir defaults to .cache/scrape in the repo (gitignored). Pages are fetched with modest concurrency (3).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const HOST = 'galacticracer.gameslantern.com';
const BASE = `https://${HOST}`;
const escapeRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** True only for URLs whose parsed hostname is exactly the data site (a string prefix check can be fooled by evil-host tricks). */
const isOurs = (x) => { try { return new URL(x).hostname === HOST; } catch { return false; } };
const pathOf = (x) => new URL(x).pathname;
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../src/data');
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const positional = argv.filter((a) => !a.startsWith('--'));
for (const f of flags) if (!['--refresh', '--check'].includes(f)) { console.error(`unknown flag ${f}`); process.exit(2); }
const REFRESH = flags.has('--refresh');
const CHECK = flags.has('--check');
// `--check [cacheDir]` is shorthand for `build --check [cacheDir]`
const implicitBuild = CHECK && !['fetch', 'build', 'all'].includes(positional[0]);
if (implicitBuild) positional.unshift('build');
const mode = positional[0] ?? 'all';
if (!['fetch', 'build', 'all'].includes(mode)) { console.error(`unknown mode ${mode}`); process.exit(2); }
if (CHECK && mode !== 'build') { console.error('--check only works with build'); process.exit(2); }
if (REFRESH && mode === 'build') { console.error('--refresh only works with fetch/all'); process.exit(2); }
const BASE_SPEEDS = { 'speeder-bike': 298, landspeeder: 298, 'skim-speeder': 306, podracer: 451 }; // km/h, not on the pages (given)
const CACHE = path.resolve(positional[1] ?? path.join(here, '..', '.cache', 'scrape'));
const CONCURRENCY = 3;
const STAMP = path.join(CACHE, '.scraped-at');

const fileFor = (url) => path.join(CACHE, url.replace(BASE, '').replace(/^\//, '').replace(/\//g, '__') + '.md');
const readOrNull = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return null; } };
const goodFile = (f) => { try { return fs.statSync(f).size > 200; } catch { return false; } };

async function scrape(url, file) {
  if (!REFRESH && goodFile(file)) return;
  const tmp = file + '.part'; // download beside the target and rename on success so a failed (re)fetch never clobbers a good copy
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      fs.rmSync(tmp, { force: true });
      await run('firecrawl', ['scrape', url, ...(url.endsWith('.xml') ? [] : ['--only-main-content']), '-o', tmp], { maxBuffer: 1 << 26 });
      if (goodFile(tmp)) { fs.renameSync(tmp, file); await new Promise((r) => setTimeout(r, 1200)); return; } // polite pacing (~100 req/min API limit)
    } catch (e) {
      if (attempt === 6) console.error('FAILED', url, e.message);
    }
    await new Promise((r) => setTimeout(r, 8000 * attempt));
  }
  fs.rmSync(tmp, { force: true });
  console.error('FAILED', url);
  process.exitCode = 1;
}

async function pool(items, fn, n) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

async function fetchAll() {
  fs.mkdirSync(CACHE, { recursive: true });
  const sm = path.join(CACHE, 'sitemap.xml');
  await scrape(`${BASE}/sitemap.xml`, sm);
  // the sitemap comes back as one run-together string of URLs
  const txt = fs.readFileSync(sm, 'utf8').replace(/\d{4}-\d\d-\d\dT[\d:+]+/g, '\n').replace(/https:\/\//g, '\nhttps://');
  const urls = [...new Set(txt.split('\n').map((s) => s.trim()).filter((s) => isOurs(s)))];
  const wanted = urls.filter((u) => /\/(vehicle-parts|abilities|racer-styles|glossary|vehicle-classes)(\/|$)/.test(pathOf(u)))
    .concat([`${BASE}/traits`, `${BASE}/unlocks`]);
  console.log('pages to fetch', wanted.length, REFRESH ? '(refresh: ignoring cache)' : '');
  let done = 0;
  await pool(wanted, async (u) => { await scrape(u, fileFor(u)); if (++done % 25 === 0) console.log(done); }, CONCURRENCY);
  // Record when this cache was last (re)downloaded; data-meta.json reports it, so copying the folder cannot change it.
  if (REFRESH || !fs.existsSync(STAMP)) fs.writeFileSync(STAMP, new Date().toISOString() + '\n');
}

// ---------------------------------------------------------------- parsing helpers
const read = (url) => {
  let md;
  try {
    md = fs.readFileSync(fileFor(url), 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error(`page not in cache: ${url} (run fetch)`);
    throw e;
  }
  if (!/^# .+/m.test(md)) throw new Error(`cached page has no title heading (blank or truncated?): ${url}`);
  return md;
};
const slugOf = (u) => u.replace(/[?#].*$/, '').split('/').filter(Boolean).pop();

/** Inline markdown -> the game's plain text: drop icon image-links (the label follows as plain text), unwrap links. */
function clean(s) {
  return s
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\\\\/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ +([.,;:!?)])/g, '$1')
    .trim();
}

/** Split a detail page into { title, header, intro: [paragraphs], sections: {heading: body} } */
function parsePage(md) {
  const lines = md.split('\n');
  const ti = lines.findIndex((l) => l.startsWith('# '));
  const title = lines[ti].slice(2).trim();
  let i = ti + 1;
  while (!lines[i].trim()) i++;
  const header = lines[i].trim();
  const rest = lines.slice(i + 1).join('\n');
  const parts = rest.split(/^## /m);
  const introRaw = parts[0].replace(/^\s*Share\s*$/m, '');
  const intro = introRaw.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  const sections = {};
  for (const sec of parts.slice(1)) {
    const nl = sec.indexOf('\n');
    sections[sec.slice(0, nl).trim()] = sec.slice(nl + 1);
  }
  // The page opens with the item's card image; its file name is the icon id (the art itself is fetched by scripts/fetch-icons.mjs).
  const icon = (lines[0].match(/\/Icons\/(?:[A-Za-z]+\/)*([A-Za-z0-9_]+)\.webp/) ?? [])[1];
  return { title, header, intro, sections, icon };
}
const paras = (body) => body.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
const links = (md, kind) => [...md.matchAll(new RegExp(`\\]\\((?:${escapeRe(BASE)})?/${kind}/([a-z0-9-]+)\\)`, 'g'))].map((m) => m[1]);

// ---------------------------------------------------------------- builders
function buildClasses() {
  const out = [];
  for (const slug of Object.keys(BASE_SPEEDS)) {
    const pg = parsePage(read(`${BASE}/vehicle-classes/${slug}`));
    const m = pg.header.match(/^Advanced: (.+?)(\d+) kits(\d+) part slots$/);
    if (!m) throw new Error('class header ' + pg.header);
    const tkey = Object.keys(pg.sections).find((k) => /traits$/.test(k));
    const traits = [];
    if (tkey) {
      const ps = paras(pg.sections[tkey]);
      for (let i = 0; i < ps.length; i += 2) traits.push({ name: clean(ps[i]), text: clean(ps[i + 1]) });
    }
    out.push({ id: slug, name: pg.title, maneuveringName: m[1], baseSpeed: BASE_SPEEDS[slug], traits, purchasable: slug !== 'podracer' });
  }
  return out;
}

function listSlugs(kind) {
  const sm = fs.readFileSync(path.join(CACHE, 'sitemap.xml'), 'utf8').replace(/\d{4}-\d\d-\d\dT[\d:+]+/g, '\n').replace(/https:\/\//g, '\nhttps://');
  return [...new Set(sm.split('\n').map((x) => x.trim()).filter((x) => isOurs(x) && pathOf(x).startsWith(`/${kind}/`)).map(slugOf))];
}

function buildAbilities() {
  const raw = listSlugs('abilities').map((slug) => {
    const pg = parsePage(read(`${BASE}/abilities/${slug}`));
    const m = pg.header.match(/^Tier (\d)(Crash ability)?(\d+) credits$/);
    if (!m) throw new Error('ability header ' + slug + ': ' + pg.header);
    const up = pg.sections['Upgrade path'] ?? '';
    const fromPart = up.includes('Upgrades from') ? up.split('Upgrades into')[0].split('Upgrades from')[1] : '';
    const from = links(fromPart, 'abilities')[0];
    // the site adds an editorial 'Pre-race check: ...' label under some abilities; it is not game text, so it is dropped
    const text = pg.intro.filter((p) => !p.startsWith('Pre-race check:')).map(clean).join('\n');
    return { id: slug, name: pg.title, tier: Number(m[1]), cost: Number(m[3]), text, crash: !!m[2], upgradesFromId: from, icon: pg.icon?.replace(/_Lg_Icn$/, '_Icn') };
  });
  const byId = Object.fromEntries(raw.map((a) => [a.id, a]));
  const rootOf = (a) => (a.upgradesFromId ? rootOf(byId[a.upgradesFromId]) : a.id);
  return raw.map((a) => {
    const o = { id: a.id, name: a.name, family: rootOf(a), tier: a.tier, cost: a.cost, text: a.text, crash: a.crash };
    if (a.upgradesFromId) o.upgradesFromId = a.upgradesFromId;
    if (a.icon) o.icon = a.icon;
    return o;
  }).sort((a, b) => a.family.localeCompare(b.family) || a.tier - b.tier || a.id.localeCompare(b.id));
}

/** Parse a "Traits" block (icon / name link / text paragraphs) into [{name,text}] */
function parseTraits(paragraphs) {
  const out = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    if (/^\[[^\]]+\]\([^)]*\/traits#[^)]*\)$/.test(p)) {
      out.push({ name: clean(p), text: clean(paragraphs[i + 1] ?? '') });
      i++;
    }
  }
  return out;
}

function parseStyleBlock(body) {
  const ps = paras(body);
  const ti = ps.findIndex((p) => p === 'Traits');
  const pre = ti === -1 ? ps : ps.slice(0, ti);
  const abilityIds = links(pre.join('\n'), 'abilities');
  const traits = ti === -1 ? [] : parseTraits(ps.slice(ti + 1));
  const lead = pre.filter((p) => !p.startsWith('[') && !p.startsWith('!['));
  return { lead: lead.map(clean), abilityIds, traits };
}

function buildStyles() {
  return listSlugs('racer-styles').map((slug) => {
    const pg = parsePage(read(`${BASE}/racer-styles/${slug}`));
    const multiplayerOnly = !/Campaign/.test(pg.header);
    const ranks = [];
    let startingAbilityId;
    let prev = [];
    for (const n of [1, 2, 3]) {
      const body = pg.sections[`Campaign rank ${n}`];
      if (body === undefined) continue;
      const b = parseStyleBlock(body);
      if (n === 1 && b.abilityIds[0]) startingAbilityId = b.abilityIds[0];
      const key = (t) => t.name + '\u0000' + t.text;
      const seen = new Set(prev.map(key));
      ranks.push({ rank: n, unlock: b.lead[0] ?? '', traits: b.traits.filter((t) => !seen.has(key(t))) });
      prev = b.traits;
    }
    const mp = pg.sections['Multiplayer'] ? parseStyleBlock(pg.sections['Multiplayer']) : { traits: [], abilityIds: [] };
    if (!startingAbilityId && multiplayerOnly && mp.abilityIds[0]) startingAbilityId = mp.abilityIds[0];
    const o = { id: slug, name: pg.title };
    if (startingAbilityId) o.startingAbilityId = startingAbilityId;
    o.ranks = ranks; o.multiplayer = mp.traits; o.multiplayerOnly = multiplayerOnly;
    return o;
  }).sort((a, b) => a.multiplayerOnly - b.multiplayerOnly || a.id.localeCompare(b.id));
}

const RARITIES = { Common: 'common', Rare: 'rare', Epic: 'epic', Legendary: 'legendary', Experimental: 'experimental' };
const ROMAN = /\s+(I|II|III|IV|V|VI)$/;
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function buildParts() {
  return listSlugs('vehicle-parts').map((slug) => {
    const url = `${BASE}/vehicle-parts/${slug}`;
    const pg = parsePage(read(url));
    const m = pg.header.match(/^(Common|Rare|Epic|Legendary|Experimental|Faulty)(?:Tier (\d+))?(.*?)(?:(\d+) credits)?$/);
    if (!m) throw new Error('part header ' + slug + ': ' + pg.header);
    const fault = m[1] === 'Faulty';
    const unlockP = pg.intro.find((p) => p.startsWith('How to unlock')) ?? '';
    const effect = pg.intro.filter((p) => !p.startsWith('How to unlock')).map(clean);
    const um = unlockP.match(/Complete (\d+) events?/);
    const unlockEvents = um ? Number(um[1]) : /Start the Campaign/.test(unlockP) ? 0 : null;
    const tierKey = Object.keys(pg.sections).find((k) => k.startsWith('Every tier of '));
    const tier = m[2] ? Number(m[2]) : undefined;
    const family = tierKey ? slugify(tierKey.slice('Every tier of '.length)) : tier ? slugify(pg.title.replace(ROMAN, '')) : undefined;
    const o = { id: slug, name: pg.title, rarity: fault ? 'common' : RARITIES[m[1]], price: fault ? null : m[4] ? Number(m[4]) : null, text: effect[0] ?? '' };
    // The site renders no separate red line: a Fault's whole effect text is its drawback.
    if (fault) o.downside = o.text;
    else if (effect.length > 1) o.downside = effect.slice(1).join('\n');
    o.fault = fault; o.unlockEvents = unlockEvents;
    if (family) o.family = family;
    if (tier) o.tier = tier;
    if (pg.icon) o.icon = pg.icon;
    o.source = url;
    return o;
  }).sort((a, b) => a.id.localeCompare(b.id));
}

function buildGlossary() {
  return listSlugs('glossary').map((slug) => {
    const pg = parsePage(read(`${BASE}/glossary/${slug}`));
    return { id: slug, name: pg.title, text: pg.intro.map(clean).join('\n') };
  }).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------- validation
// Minimum sizes; the site currently has 4 / 20 / 45 / 318 / 55.
const MIN_COUNTS = { classes: 4, styles: 20, abilities: 45, parts: 300, glossary: 50 };
const MAX_ID_LOSS = 0.05; // fail if more than 5% of the ids already on disk disappear

// ALLOW-LIST: the only parts that may have a null price. Everything else must have a finite price.
//  - every Fault (fault === true): Faults are not bought, the site only shows a 250 credit clearing cost
//  - these podracer-loadout parts, which the site shows with no price at all (no "N credits" in the page header)
const NULL_PRICE_IDS = new Set([
  'bleeding-edge-tech', 'built-for-battle', 'double-control-surfaces', 'energy-surplus',
  'optimized-nozzles', 'overbuilt-engines', 'plug-f-power-cell',
]);
// ALLOW-LIST: the only parts that may have a null unlockEvents (the page has no "Complete N events" / "Start the Campaign" line).
//  - podracer-loadout parts and a few Faults with no "How to unlock" line on the page
//  - the three Ramming Jet parts, which unlock through a paddock interaction instead of events
const NULL_UNLOCK_IDS = new Set([
  'bleeding-edge-tech', 'built-for-battle', 'complex-interlocks', 'corrode-resistance-2', 'double-control-surfaces',
  'draggy-control-surfaces', 'energy-surplus', 'faulty-abilities', 'fractured-abilities', 'improved-regulators-ii-2',
  'large-cross-section', 'massive-momentum', 'old-dog-old-tricks', 'only-human', 'optimized-nozzles', 'overbuilt-engines',
  'plug-f-power-cell', 'ramming-jet-i', 'ramming-jet-ii', 'ramming-jet-iii', 'small-thrusters',
]);

const FILES = { classes: 'vehicle-classes.json', styles: 'racer-styles.json', abilities: 'abilities.json', parts: 'parts.json', glossary: 'glossary.json' };
const blank = (v) => typeof v !== 'string' || v.trim() === '';
const num = (v) => typeof v === 'number' && Number.isFinite(v);

function readExisting() {
  const prev = {};
  for (const [k, f] of Object.entries(FILES)) {
    try { prev[k] = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')); } catch { /* no previous file */ }
  }
  return prev;
}

/** Returns a list of problems (empty = ok). Never writes anything. */
function validate(d, prev) {
  const problems = [];
  const dup = (name, arr) => { const s = new Set(); for (const x of arr) { if (s.has(x.id)) problems.push(`duplicate ${name} id ${x.id}`); s.add(x.id); } return s; };
  dup('class', d.classes); dup('style', d.styles); const ab = dup('ability', d.abilities); dup('part', d.parts); dup('glossary', d.glossary);

  for (const [k, min] of Object.entries(MIN_COUNTS)) if (d[k].length < min) problems.push(`${k}: only ${d[k].length} entries, expected at least ${min}`);

  for (const s of d.styles) {
    if (blank(s.name)) problems.push(`style ${s.id}: empty name`);
    if (s.startingAbilityId && !ab.has(s.startingAbilityId)) problems.push(`style ${s.id}: unknown startingAbilityId ${s.startingAbilityId}`);
    const traitLists = [...s.ranks.map((r) => r.traits), s.multiplayer];
    for (const t of traitLists.flat()) if (blank(t.name) || blank(t.text)) problems.push(`style ${s.id}: trait with empty name/text (${JSON.stringify(t.name)})`);
    for (const r of s.ranks) if (blank(r.unlock)) problems.push(`style ${s.id}: rank ${r.rank} has no unlock text`);
    if (s.multiplayerOnly) {
      if (s.multiplayer.length === 0) problems.push(`style ${s.id}: multiplayer-only style has no multiplayer traits`);
    } else if (!s.ranks.some((r) => r.traits.length > 0)) problems.push(`style ${s.id}: campaign style has no rank with traits`);
  }
  for (const a of d.abilities) {
    if (blank(a.name) || blank(a.text)) problems.push(`ability ${a.id}: empty name/text`);
    if (!num(a.cost) || a.cost <= 0) problems.push(`ability ${a.id}: bad cost ${a.cost}`);
    if (!a.icon) problems.push(`ability ${a.id}: no icon`);
    if (![1, 2, 3].includes(a.tier)) problems.push(`ability ${a.id}: bad tier ${a.tier}`);
    if (a.upgradesFromId && !ab.has(a.upgradesFromId)) problems.push(`ability ${a.id}: unknown upgradesFromId ${a.upgradesFromId}`);
  }
  for (const p of d.parts) {
    if (blank(p.name) || blank(p.text)) problems.push(`part ${p.id}: empty name/text`);
    if (!p.icon) problems.push(`part ${p.id}: no icon`);
    if (p.price === null) { if (!p.fault && !NULL_PRICE_IDS.has(p.id)) problems.push(`part ${p.id}: null price is not in the allow-list`); }
    else if (!num(p.price) || p.price <= 0) problems.push(`part ${p.id}: bad price ${p.price}`);
    if (p.unlockEvents === null) { if (!NULL_UNLOCK_IDS.has(p.id)) problems.push(`part ${p.id}: null unlockEvents is not in the allow-list`); }
    else if (!num(p.unlockEvents) || p.unlockEvents < 0) problems.push(`part ${p.id}: bad unlockEvents ${p.unlockEvents}`);
    if (p.fault && blank(p.downside)) problems.push(`part ${p.id}: fault without downside`);
  }
  for (const g of d.glossary) if (blank(g.name) || blank(g.text)) problems.push(`glossary ${g.id}: empty name/text`);
  for (const c of d.classes) {
    if (blank(c.name) || blank(c.maneuveringName) || !num(c.baseSpeed)) problems.push(`class ${c.id}: missing name/maneuveringName/baseSpeed`);
    if (c.traits.length === 0 && c.id !== 'podracer') problems.push(`class ${c.id}: no traits (only podracer may be empty)`);
    for (const t of c.traits) if (blank(t.name) || blank(t.text)) problems.push(`class ${c.id}: trait with empty name/text`);
  }

  // id regression vs what is currently on disk
  for (const k of Object.keys(FILES)) {
    if (!Array.isArray(prev[k]) || prev[k].length === 0) continue;
    const now = new Set(d[k].map((x) => x.id));
    const missing = prev[k].map((x) => x.id).filter((id) => !now.has(id));
    if (missing.length / prev[k].length > MAX_ID_LOSS) {
      problems.push(`${k}: lost ${missing.length} of ${prev[k].length} previous ids (> ${MAX_ID_LOSS * 100}%): ${missing.join(', ')}`);
    } else if (missing.length) console.warn(`warning: ${k}: ${missing.length} previous id(s) no longer present: ${missing.join(', ')}`);
  }
  return problems;
}

// ---------------------------------------------------------------- meta
function buildMeta(d) {
  const stampedAt = readOrNull(STAMP)?.trim() || null;
  const pages = {};
  let newest = 0;
  for (const name of fs.readdirSync(CACHE).filter((n) => n.endsWith('.md') || n === 'sitemap.xml')) {
    // Open once and read through the descriptor, so the size/time and the bytes always come from the same file.
    const fd = fs.openSync(path.join(CACHE, name), 'r');
    try {
      newest = Math.max(newest, fs.fstatSync(fd).mtimeMs);
      const key = name === 'sitemap.xml' ? '/sitemap.xml' : '/' + name.slice(0, -3).replace(/__/g, '/');
      pages[key] = crypto.createHash('sha256').update(fs.readFileSync(fd)).digest('hex');
    } finally {
      fs.closeSync(fd);
    }
  }
  const sorted = Object.fromEntries(Object.entries(pages).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return {
    scrapedAt: stampedAt ?? new Date(newest).toISOString(), // the fetch step's stamp (falls back to the newest file time); never now()
    source: BASE,
    counts: { classes: d.classes.length, styles: d.styles.length, abilities: d.abilities.length, parts: d.parts.length, faults: d.parts.filter((p) => p.fault).length, glossary: d.glossary.length },
    pages: sorted,
  };
}

// ---------------------------------------------------------------- build
function build() {
  const d = { classes: buildClasses(), styles: buildStyles(), abilities: buildAbilities(), parts: buildParts(), glossary: buildGlossary() };
  const problems = validate(d, readExisting());
  const c = buildMeta(d).counts;
  console.log(`classes ${c.classes}, styles ${c.styles}, abilities ${c.abilities}, parts ${c.parts} (faults ${c.faults}), glossary ${c.glossary}`);
  if (problems.length) {
    console.error(`VALIDATION FAILED (${problems.length}); nothing was written:\n  ` + problems.join('\n  '));
    process.exit(1);
  }
  // everything is validated; serialise in memory first
  const outputs = {};
  for (const [k, f] of Object.entries(FILES)) outputs[f] = JSON.stringify(d[k], null, 2) + '\n';
  outputs['data-meta.json'] = JSON.stringify(buildMeta(d), null, 2) + '\n';

  if (CHECK) {
    const differ = Object.entries(outputs).filter(([f, text]) => readOrNull(path.join(OUT, f)) !== text).map(([f]) => f);
    if (differ.length) {
      console.error(`CHECK FAILED: ${differ.length} file(s) out of date: ${differ.join(', ')}. Run: node scripts/scrape-data.mjs build`);
      process.exit(1);
    }
    console.log('check ok: src/data matches the cache');
    return;
  }
  // write all to temp files first, then rename into place
  fs.mkdirSync(OUT, { recursive: true });
  const tmps = Object.entries(outputs).map(([f, text]) => { const t = path.join(OUT, `.${f}.${process.pid}.tmp`); fs.writeFileSync(t, text); return [t, path.join(OUT, f)]; });
  for (const [t, dest] of tmps) fs.renameSync(t, dest);
}

try {
  if (mode === 'fetch' || mode === 'all') await fetchAll();
  if ((mode === 'build' || mode === 'all') && !process.exitCode) build();
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
}
