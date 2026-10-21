#!/usr/bin/env node
// Crawls the built site (dist/) and fails if any internal link or image points at a file that does not exist.
//   node scripts/check-links.mjs [distDir]
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.argv[2] ?? 'dist');
const pages = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.name.endsWith('.html')) pages.push(f);
  }
})(dist);

const exists = (rel) => {
  const target = path.join(dist, decodeURIComponent(rel));
  return fs.existsSync(target) && (fs.statSync(target).isFile() || fs.existsSync(path.join(target, 'index.html')));
};
// These are served by rewrites or the Pages Function rather than by a file in dist.
const dynamic = (href) => href.startsWith('/b/');

const broken = new Map();
let checked = 0;
for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)(?:[?#][^"]*)?"/g)) {
    const href = m[1];
    if (href.startsWith('//') || dynamic(href)) continue;
    checked++;
    if (!exists(href)) {
      const list = broken.get(href) ?? [];
      list.push(path.relative(dist, page));
      broken.set(href, list);
    }
  }
}
console.log(`${pages.length} pages, ${checked} internal links checked`);
if (broken.size) {
  for (const [href, from] of broken) console.error(`BROKEN ${href}  (on ${from.slice(0, 3).join(', ')}${from.length > 3 ? ` +${from.length - 3} more` : ''})`);
  process.exit(1);
}
