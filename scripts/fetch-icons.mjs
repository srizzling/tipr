#!/usr/bin/env node
// Downloads the game's icon art referenced by src/data/*.json and converts it to small files in public/game/.
//
//   node scripts/fetch-icons.mjs [--force] [cacheDir]
//
// Needs ImageMagick (`magick`, provided by the devenv shell). The source images are WebP, which the image
// renderer used for share images cannot draw, so they are converted: transparent PNG for glyphs, JPEG for the
// part card photos. Nothing here is original art; see public/game/NOTICE.md.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'galacticracer.gameslantern.com';
const BASE = `https://${HOST}/storage/sites/galacticracer/Icons`;
const MAX_BYTES = 2 * 1024 * 1024;
const force = process.argv.includes('--force');
const CACHE = path.resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) ?? path.join(root, '.cache', 'icons'));
const OUT = path.join(root, 'public/game');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, 'src/data', f), 'utf8'));

// Stat rows: one glyph each. Afterburner and Ramjet have no BuildStats icon, so their keyword glyphs are used.
const STATS = {
  speed: 'BuildStats/T_UI_BuildStats_Speed_Icn',
  afterburner: 'Keywords/T_UI_Keyword_Afterburner_Icn',
  ramjet: 'Keywords/T_UI_Keyword_Ramjet_Icn',
  cornering: 'BuildStats/T_UI_BuildStats_Cornering_Icn',
  resilience: 'BuildStats/T_UI_BuildStats_Resilience_Icn',
  battery: 'BuildStats/T_UI_BuildStats_Battery_Icn',
  maneuvering: 'BuildStats/T_UI_BuildStats_Advanced_Icn',
};

const jobs = [];
for (const icon of new Set(read('abilities.json').map((a) => a.icon).filter(Boolean))) {
  jobs.push({ kind: 'abilities', urls: [`${BASE}/Abilities/${icon}.webp`], out: `abilities/${icon}.png`, args: ['-background', 'none', '-resize', '96x96'] });
}
for (const icon of new Set(read('parts.json').map((p) => p.icon).filter(Boolean))) {
  // Cards are 472x244 with a rounded cream border; crop the border off, then shrink.
  jobs.push({ kind: 'parts', urls: [`${BASE}/Affixes/LargeAffixIcons/${icon}.webp`, `${BASE}/Affixes/${icon}.webp`], out: `parts/${icon}.jpg`, args: ['-crop', '456x228+8+8', '+repage', '-resize', '192x', '-quality', '72'] });
}
for (const [name, rel] of Object.entries(STATS)) {
  jobs.push({ kind: 'stats', urls: [`${BASE}/${rel}.webp`], out: `stats/${name}.png`, args: ['-background', 'none', '-resize', '64x64'] });
}

async function fetchTo(urls, file) {
  for (const url of urls) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (new URL(url).hostname !== HOST) throw new Error('refusing to fetch from another host');
        const res = await fetch(url);
        if (res.status === 404) break;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const bytes = Buffer.from(await res.arrayBuffer());
        // Only keep what is really a small WebP image (RIFF....WEBP), whatever the server sent.
        if (bytes.length > MAX_BYTES || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') {
          throw new Error('not a WebP image');
        }
        const tmp = `${file}.part`;
        fs.writeFileSync(tmp, bytes);
        fs.renameSync(tmp, file);
        return url;
      } catch (e) {
        if (attempt === 3) console.error('failed', url, e.message);
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
  }
  return null;
}

let done = 0;
const failed = [];
async function doJob(j) {
  const target = path.join(OUT, j.out);
  if (!force && fs.existsSync(target)) return;
  const src = path.join(CACHE, `${j.kind}__${path.basename(j.out, path.extname(j.out))}.webp`);
  if (!fs.existsSync(src) || force) {
    if (!(await fetchTo(j.urls, src))) return void failed.push(j.out);
    await new Promise((r) => setTimeout(r, 150));
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  await run('magick', [src, ...j.args, '-strip', '-define', 'png:compression-level=9', target]);
  if (++done % 50 === 0) console.log(done, 'converted');
}

fs.mkdirSync(CACHE, { recursive: true });
let i = 0;
await Promise.all(Array.from({ length: 4 }, async () => { while (i < jobs.length) await doJob(jobs[i++]); }));
const size = (dir) => fs.readdirSync(dir).reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
for (const k of ['abilities', 'parts', 'stats']) {
  const dir = path.join(OUT, k);
  if (fs.existsSync(dir)) console.log(k, fs.readdirSync(dir).length, 'files', Math.round(size(dir) / 1024), 'KB');
}
if (failed.length) { console.error('MISSING:', failed.join(', ')); process.exitCode = 1; }
