#!/usr/bin/env node
// Performance budget: fails if the planner page loads too much JavaScript or any page's HTML gets too big.
//   node scripts/check-budget.mjs [distDir]
// Sizes are gzip, a close stand-in for what Cloudflare sends (it serves Brotli, which is a little smaller).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const dist = path.resolve(process.argv[2] ?? 'dist');
const KB = 1024;
const BUDGET = {
  /** All JavaScript the planner page needs to become interactive, following static imports. */
  plannerJs: 130 * KB,
  /** Stylesheets for any page. */
  css: 12 * KB,
  /** The biggest HTML page, gzipped. */
  html: 20 * KB,
};

const gz = (buf) => zlib.gzipSync(buf, { level: 9 }).length;
const read = (rel) => fs.readFileSync(path.join(dist, rel));

// The planner page's JS: every chunk it names, plus every chunk those import statically.
const html = read('index.html').toString('utf8');
const seen = new Map();
const queue = [...new Set(html.match(/\/_astro\/[A-Za-z0-9_.-]+\.js/g) ?? [])];
while (queue.length) {
  const url = queue.pop();
  if (seen.has(url)) continue;
  const buf = read(url.slice(1));
  seen.set(url, gz(buf));
  for (const m of buf.toString('utf8').matchAll(/(?:from|import)\s*["']\.\/([A-Za-z0-9_.-]+\.js)["']/g)) queue.push(`/_astro/${m[1]}`);
}
const plannerJs = [...seen.values()].reduce((a, b) => a + b, 0);

let css = 0;
for (const f of fs.readdirSync(path.join(dist, '_astro')).filter((n) => n.endsWith('.css'))) css = Math.max(css, gz(read(`_astro/${f}`)));

let biggest = { size: 0, file: '' };
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.name.endsWith('.html')) {
      const size = gz(fs.readFileSync(f));
      if (size > biggest.size) biggest = { size, file: path.relative(dist, f) };
    }
  }
})(dist);

const rows = [
  ['Planner JavaScript', plannerJs, BUDGET.plannerJs],
  ['Largest stylesheet', css, BUDGET.css],
  [`Largest HTML (${biggest.file})`, biggest.size, BUDGET.html],
];
let failed = false;
for (const [name, size, limit] of rows) {
  const ok = size <= limit;
  failed ||= !ok;
  console.log(`${ok ? 'ok  ' : 'OVER'} ${name.padEnd(42)} ${(size / KB).toFixed(1).padStart(6)} KB / ${(limit / KB).toFixed(0)} KB`);
}
if (failed) {
  console.error('\nA budget was exceeded. Check what the last change added (new dependency? data in a shared chunk?).');
  process.exit(1);
}
