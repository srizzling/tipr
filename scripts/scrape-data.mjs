#!/usr/bin/env node
// Scrapes game data from https://galacticracer.gameslantern.com into src/data/*.json
//
// Usage:
//   node scripts/scrape-data.mjs fetch [cacheDir]   # download raw markdown pages via the firecrawl CLI (cached, resumable)
//   node scripts/scrape-data.mjs build [cacheDir]   # parse cached pages -> src/data/*.json and validate
//   node scripts/scrape-data.mjs all   [cacheDir]
//
// Requirements: the `firecrawl` CLI (authenticated), because the site is behind Cloudflare and
// plain curl gets a 403. The page list comes from /sitemap.xml (scraped through firecrawl).
// The cache dir defaults to /tmp/gr-cache2. Pages are fetched with modest concurrency (3).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const BASE = 'https://galacticracer.gameslantern.com';
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../src/data');
const mode = process.argv[2] ?? 'all';
const BASE_SPEEDS = { 'speeder-bike': 298, landspeeder: 298, 'skim-speeder': 306, podracer: 451 }; // km/h, not on the pages (given)
const CACHE = path.resolve(process.argv[3] ?? '/tmp/gr-cache2');
const CONCURRENCY = 3;

const fileFor = (url) => path.join(CACHE, url.replace(BASE, '').replace(/^\//, '').replace(/\//g, '__') + '.md');

async function scrape(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 200) return;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      await run('firecrawl', ['scrape', url, ...(url.endsWith('.xml') ? [] : ['--only-main-content']), '-o', file], { maxBuffer: 1 << 26 });
      if (fs.existsSync(file) && fs.statSync(file).size > 200) { await new Promise((r) => setTimeout(r, 1200)); return; } // polite pacing (~100 req/min API limit)
    } catch (e) {
      if (attempt === 6) console.error('FAILED', url, e.message);
    }
    await new Promise((r) => setTimeout(r, 8000 * attempt));
  }
}

async function pool(items, fn, n) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

async function fetchAll() {
  fs.mkdirSync(CACHE, { recursive: true });
  const sm = path.join(CACHE, 'sitemap.xml');
  await scrape(`${BASE}/sitemap.xml`, sm.replace(/\.xml$/, '.xml'));
  // the sitemap comes back as one run-together string of URLs
  const txt = fs.readFileSync(sm, 'utf8').replace(/\d{4}-\d\d-\d\dT[\d:+]+/g, '\n').replace(/https:\/\//g, '\nhttps://');
  const urls = [...new Set(txt.split('\n').map((s) => s.trim()).filter((s) => s.startsWith(BASE)))];
  const wanted = urls.filter((u) => /\/(vehicle-parts|abilities|racer-styles|glossary|vehicle-classes)(\/|$)/.test(u.replace(BASE, '')) )
    .concat([`${BASE}/traits`, `${BASE}/unlocks`]);
  console.log('pages to fetch', wanted.length);
  let done = 0;
  await pool(wanted, async (u) => { await scrape(u, fileFor(u)); if (++done % 25 === 0) console.log(done); }, CONCURRENCY);
}

// ---------------------------------------------------------------- parsing helpers
const read = (url) => fs.readFileSync(fileFor(url), 'utf8');
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
  return { title, header, intro, sections };
}
const paras = (body) => body.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
const links = (md, kind) => [...md.matchAll(new RegExp(`\\]\\((?:${BASE.replace(/\./g, '\\.')})?/${kind}/([a-z0-9-]+)\\)`, 'g'))].map((m) => m[1]);

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
  return [...new Set(sm.split('\n').map((x) => x.trim()).filter((x) => x.startsWith(`${BASE}/${kind}/`)).map(slugOf))];
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
    return { id: slug, name: pg.title, tier: Number(m[1]), cost: Number(m[3]), text, crash: !!m[2], upgradesFromId: from };
  });
  const byId = Object.fromEntries(raw.map((a) => [a.id, a]));
  const rootOf = (a) => (a.upgradesFromId ? rootOf(byId[a.upgradesFromId]) : a.id);
  return raw.map((a) => {
    const o = { id: a.id, name: a.name, family: rootOf(a), tier: a.tier, cost: a.cost, text: a.text, crash: a.crash };
    if (a.upgradesFromId) o.upgradesFromId = a.upgradesFromId;
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
    o.source = url;
    o._unlock = unlockP; o._cat = m[3];
    return o;
  }).sort((a, b) => a.id.localeCompare(b.id));
}

function buildGlossary() {
  return listSlugs('glossary').map((slug) => {
    const pg = parsePage(read(`${BASE}/glossary/${slug}`));
    return { id: slug, name: pg.title, text: pg.intro.map(clean).join('\n') };
  }).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

function validate(d) {
  const problems = [];
  const dup = (name, arr) => { const s = new Set(); for (const x of arr) { if (s.has(x.id)) problems.push(`duplicate ${name} id ${x.id}`); s.add(x.id); } return s; };
  dup('class', d.classes); const st = dup('style', d.styles); const ab = dup('ability', d.abilities); dup('part', d.parts); dup('glossary', d.glossary);
  for (const s of d.styles) if (s.startingAbilityId && !ab.has(s.startingAbilityId)) problems.push(`style ${s.id}: unknown startingAbilityId ${s.startingAbilityId}`);
  for (const a of d.abilities) if (a.upgradesFromId && !ab.has(a.upgradesFromId)) problems.push(`ability ${a.id}: unknown upgradesFromId`);
  console.log(`classes ${d.classes.length}, styles ${d.styles.length}, abilities ${d.abilities.length}, parts ${d.parts.length} (faults ${d.parts.filter((p) => p.fault).length}), glossary ${d.glossary.length}`);
  if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
}

function build() {
  const d = { classes: buildClasses(), styles: buildStyles(), abilities: buildAbilities(), parts: buildParts(), glossary: buildGlossary() };
  validate(d);
  fs.mkdirSync(OUT, { recursive: true });
  for (const p of d.parts) { delete p._unlock; delete p._cat; }
  const w = (f, v) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(v, null, 2) + '\n');
  w('vehicle-classes.json', d.classes); w('racer-styles.json', d.styles); w('abilities.json', d.abilities); w('parts.json', d.parts); w('glossary.json', d.glossary);
}

if (mode === 'fetch' || mode === 'all') await fetchAll();
if (mode === 'build' || mode === 'all') build();
