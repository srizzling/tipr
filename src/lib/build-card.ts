import type { GameData, Part, StatId } from '../data/types';
import { STAT_IDS } from '../data/types';
import {
  MAX_BOXES_PER_STAT,
  MAX_ENERGY_SCALE,
  MAX_PARTS,
  maxEnergy,
  topSpeed,
  totalBoxes,
  tuningCost,
  vehicleLevel,
  type Build,
} from './build';
import { ICON_PATHS, type IconName } from './icons';
import { CARD_HEIGHT, CARD_WIDTH, escapeXml, fit } from './og-card';
import { buildVerdict, type Verdict } from './verdict';
import { abilityArtUrl, partThumbUrl, statArtUrl, type StatArt } from './game-art';

/**
 * A faithful replica of the build screen (stats, style, abilities, parts) as a 1200x630 SVG, filled with a real
 * build. It is the "screenshot" used for the Save image button and for per-build link previews.
 * Text is laid out by hand because resvg and SVG images do not wrap.
 */

const C = {
  paper: '#ecebe3',
  paperDark: '#d9d9cf',
  slate: '#324b51',
  row: 'rgba(255,255,255,0.07)',
  rule: 'rgba(255,255,255,0.28)',
  ink: '#101a1d',
  text: '#e3ebe9',
  bright: '#f1f6f4',
  muted: '#98aeac',
  gold: '#e8b04a',
  red: '#d8503f',
  redBg: 'rgba(18,12,12,0.55)',
  box: '#6f8a8c',
};

const STAT_LABELS: Record<Exclude<StatId, 'maneuvering'>, string> = {
  afterburner: 'Afterburner',
  ramjet: 'Ramjet',
  cornering: 'Cornering',
  resilience: 'Resilience',
  battery: 'Battery',
};

/** Splits text into at most `maxLines` lines of about `maxChars` characters, ending with an ellipsis if cut. */
export function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  const words = text.split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (next.length <= maxChars || !line) {
      line = next;
    } else {
      lines.push(line);
      line = words[i];
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  const used = lines.join(' ').split(/\s+/).length;
  if (used < words.length) lines[lines.length - 1] = fit(`${lines[lines.length - 1]}…`, maxChars + 1).replace(/…?$/, '…');
  return lines.slice(0, maxLines);
}

const icon = (name: IconName, x: number, y: number, size: number, color: string) =>
  `<g transform="translate(${x} ${y}) scale(${size / 24})" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name]
    .map((d) => `<path d="${d}"/>`)
    .join('')}</g>`;

const rect = (x: number, y: number, w: number, h: number, r: number, fill: string, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;

function t(x: number, y: number, size: number, fill: string, content: string, extra = '') {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${content}</text>`;
}

export interface CardOptions {
  /** CSS @font-face rules to embed (data URLs), needed when the SVG is drawn as an image in a browser. */
  fontCss?: string;
  /** The joke shown in the header. Defaults to the build's standard verdict (seed 0), which is what shared pages show. */
  verdict?: Verdict;
  /** The game's art as data: URLs, keyed by the URL path (see artUrlsFor). Without it, original line icons are drawn. */
  images?: Record<string, string>;
}

export function buildCardSvg(build: Build, data: GameData, opts: CardOptions = {}): string {
  const cls = data.vehicleClasses.find((c) => c.id === build.classId);
  if (!cls) throw new Error(`Unknown vehicle class ${build.classId}`);
  const style = data.racerStyles.find((s) => s.id === build.styleId);
  const traits = style ? style.ranks.filter((r) => r.rank <= build.styleRank).flatMap((r) => r.traits) : [];
  const find = (id: string | null): Part | undefined => data.parts.find((p) => p.id === id);
  const ability = (id: string | null) => data.abilities.find((a) => a.id === id);

  const names = data.glossary.map((g) => g.name).sort((a, b) => b.length - a.length);
  const kwRe = names.length ? new RegExp(`\\b(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'g') : null;
  /** One line of text with game keywords in gold. */
  const rich = (line: string) => {
    if (!kwRe) return escapeXml(line);
    let out = '';
    let last = 0;
    for (const m of line.matchAll(kwRe)) {
      out += escapeXml(line.slice(last, m.index));
      out += `<tspan fill="${C.gold}">${escapeXml(m[0])}</tspan>`;
      last = m.index! + m[0].length;
    }
    return out + escapeXml(line.slice(last));
  };

  const boxes = totalBoxes(build.tuning);
  const speed = topSpeed(cls.baseSpeed, build.tuning, cls.id === 'podracer');
  const parts: string[] = [];
  const push = (s: string) => parts.push(s);
  const img = (url: string | null) => (url ? opts.images?.[url] : undefined);
  const statGlyph = (stat: StatArt, x: number, y: number, size: number) => {
    const href = img(statArtUrl(stat));
    return href ? `<image href="${href}" x="${x}" y="${y}" width="${size}" height="${size}"/>` : icon(stat === 'speed' ? 'speed' : stat, x, y, size, C.text);
  };

  // ---- frame and header ----
  push(rect(0, 0, CARD_WIDTH, CARD_HEIGHT, 0, C.paper));
  push(t(34, 88, 68, C.ink, '<tspan font-style="italic">/</tspan>BUILD', 'font-weight="700"'));
  push(rect(238, 54, 62, 26, 4, C.red));
  const verdict = opts.verdict ?? buildVerdict(build, data);
  push(t(332, 46, 12, C.red, 'VERDICT', 'font-weight="700" letter-spacing="3"'));
  push(t(332, 76, 25, C.ink, escapeXml(fit(verdict.title, 30)), 'font-weight="700"'));
  push(t(332, 96, 14, '#55666a', escapeXml(fit(verdict.line, 62)), ''));
  push(t(269, 73, 15, '#fff', 'TIPR', 'font-weight="700" text-anchor="middle" letter-spacing="3"'));
  const pill = (right: number, label: string, value: string) => {
    const w = Math.round((label.length + value.length) * 8.2 + 44);
    push(rect(right - w, 26, w, 34, 17, C.ink));
    push(t(right - w + 18, 49, 17, C.text, `${escapeXml(label)} <tspan fill="${C.gold}" font-weight="700">${escapeXml(value)}</tspan>`, 'font-weight="600"'));
    return w;
  };
  const w2 = pill(1164, 'TUNING POINTS', String(tuningCost(boxes)));
  pill(1164 - w2 - 10, cls.name.toUpperCase(), `LV ${vehicleLevel(build.tuning)}`);
  push(t(1164, 92, 13, '#55666a', 'THIS IS POD RACING', 'font-weight="700" text-anchor="end" letter-spacing="3"'));
  push(rect(24, 108, 1152, 498, 14, C.paperDark));

  const panel = (x: number, y: number, w: number, h: number, title: string, aside?: string) => {
    push(rect(x, y, w, h, 10, C.slate));
    push(t(x + 14, y + 28, 17, C.bright, escapeXml(title.toUpperCase()), 'font-weight="700" letter-spacing="2"'));
    if (aside) push(t(x + w - 14, y + 28, 15, C.muted, escapeXml(aside), 'font-weight="600" text-anchor="end"'));
    push(`<rect x="${x + 14}" y="${y + 36}" width="${w - 28}" height="1" fill="${C.rule}"/>`);
  };

  // ---- vehicle stats ----
  const LX = 36;
  panel(LX, 120, 340, 474, 'Vehicle stats');
  push(t(LX + 14, 70 + 120, 20, C.bright, escapeXml(cls.name.toUpperCase()), 'font-weight="700" letter-spacing="1.5"'));
  push(rect(LX + 12, 200, 316, 38, 6, C.row));
  push(statGlyph('speed', LX + 22, 208, 22));
  push(t(LX + 54, 226, 17, C.bright, 'SPEED', 'font-weight="700" letter-spacing="2.5"'));
  push(t(LX + 322, 229, 28, C.bright, String(speed), 'font-weight="700" text-anchor="end"'));
  STAT_IDS.forEach((stat, i) => {
    const y = 244 + i * 49;
    push(rect(LX + 12, y, 316, 44, 6, C.row));
    push(statGlyph(stat, LX + 22, y + 11, 22));
    push(t(LX + 54, y + 16, 12, C.muted, escapeXml((stat === 'maneuvering' ? cls.maneuveringName : STAT_LABELS[stat]).toUpperCase()), 'font-weight="600" letter-spacing="1.5"'));
    for (let b = 0; b < MAX_BOXES_PER_STAT; b++) {
      push(rect(LX + 54 + b * 19, y + 24, 15, 12, 4, b < build.tuning[stat] ? C.bright : C.box, b < build.tuning[stat] ? '' : 'opacity="0.55"'));
    }
    for (let b = 0; b < 3; b++) push(rect(LX + 54 + 7 * 19 + 2 + b * 24, y + 22, 20, 15, 4, C.box, 'opacity="0.35"'));
  });
  push(t(LX + 18, 552, 12, C.muted, 'MAX ENERGY', 'font-weight="600" letter-spacing="1.5"'));
  const energy = maxEnergy(build.tuning);
  for (let d = 0; d < MAX_ENERGY_SCALE; d++) {
    push(`<circle cx="${LX + 22 + d * 19}" cy="574" r="5" fill="${d < energy ? C.bright : C.box}" ${d < energy ? '' : 'opacity="0.5"'}/>`);
  }

  // ---- racer style ----
  const MX = 388;
  panel(MX, 120, 420, 296, 'Racer style');
  push(t(MX + 14, 70 + 120, 20, C.bright, escapeXml(style ? `${style.name.toUpperCase()} · RANK ${build.styleRank}` : 'NO STYLE'), 'font-weight="700" letter-spacing="1.5"'));
  // Give traits two lines when they all fit, otherwise one, so the panel never overflows.
  const shown = traits.slice(0, 4);
  const layout = (maxLines: number) => shown.map((tr) => ({ tr, lines: wrap(tr.text, 58, maxLines) }));
  const heightOf = (rows: { lines: string[] }[]) => rows.reduce((h, r) => h + 26 + 15 * r.lines.length, 0) + 4 * Math.max(0, rows.length - 1);
  let rows = layout(2);
  if (heightOf(rows) > 212) rows = layout(1);
  let ty = 198;
  for (const { tr, lines } of rows) {
    const h = 26 + 15 * lines.length;
    push(rect(MX + 12, ty, 396, h, 6, C.row));
    push(t(MX + 24, ty + 16, 12, C.muted, escapeXml(fit(tr.name.toUpperCase(), 40)), 'font-weight="600" letter-spacing="1.8"'));
    lines.forEach((line, li) => push(t(MX + 24, ty + 32 + li * 15, 14.5, C.text, rich(line), '')));
    ty += h + 4;
  }

  // ---- abilities ----
  panel(MX, 426, 420, 168, 'Abilities');
  const slots: { label: string; id: string | null; x: number; y: number; w: number }[] = [
    ...[0, 1, 2, 3].map((i) => ({ label: `Ability ${i + 1}`, id: build.abilities[i] ?? null, x: MX + 12 + (i % 2) * 201, y: 472 + Math.floor(i / 2) * 45, w: 195 })),
    { label: 'Crash Ability', id: build.crashAbility, x: MX + 12, y: 562, w: 396 },
  ];
  slots.forEach((s) => {
    const crash = s.label === 'Crash Ability';
    const h = crash ? 30 : 40;
    const r = crash ? 11 : 14;
    const a = ability(s.id);
    push(rect(s.x, s.y, s.w, h, 8, C.row));
    const cy = s.y + h / 2;
    push(`<circle cx="${s.x + 22}" cy="${cy}" r="${r}" fill="${a ? '#eef3f1' : 'rgba(255,255,255,0.1)'}"/>`);
    if (a) {
      const href = img(abilityArtUrl(a));
      const gs = crash ? 16 : 20;
      push(href ? `<image href="${href}" x="${s.x + 22 - gs / 2}" y="${cy - gs / 2}" width="${gs}" height="${gs}" filter="url(#tint)"/>` : icon('ability', s.x + 22 - 7, cy - 7, 14, C.slate));
    }
    const nx = s.x + 22 + r + 9;
    if (a && crash) {
      push(t(nx, cy + 5, 13, C.bright, `${escapeXml(fit(a.name.toUpperCase(), 40))} <tspan font-size="11" fill="${C.muted}" font-weight="500" letter-spacing="0">· Crash Ability</tspan>`, 'font-weight="700" letter-spacing="0.8"'));
    } else if (a) {
      push(t(nx, cy - 1, 13, C.bright, escapeXml(fit(a.name.toUpperCase(), 18)), 'font-weight="700" letter-spacing="0.6"'));
      push(t(nx, cy + 12, 10.5, C.muted, escapeXml(s.label), ''));
    } else {
      push(t(nx, cy + 5, 12.5, C.muted, escapeXml(s.label), ''));
    }
  });

  // ---- installed parts ----
  const RX = 820;
  const list = build.parts.slice(0, MAX_PARTS).flatMap((p) => {
    const part = find(p.id);
    return part ? [{ part, fault: find(p.fault) }] : [];
  });
  panel(RX, 120, 344, 474, 'Installed parts', `${list.length}/${MAX_PARTS}`);
  list.forEach(({ part, fault }, i) => {
    const y = 166 + i * 106;
    push(rect(RX + 12, y, 320, 100, 8, C.row));
    const card = img(partThumbUrl(part));
    if (card) {
      push(`<clipPath id="pc${i}"><rect x="${RX + 22}" y="${y + 10}" width="76" height="40" rx="8"/></clipPath>`);
      push(`<image href="${card}" x="${RX + 22}" y="${y + 10}" width="76" height="40" preserveAspectRatio="xMidYMid slice" clip-path="url(#pc${i})"/>`);
    } else {
      push(rect(RX + 22, y + 10, 40, 40, 8, 'rgba(255,255,255,0.1)'));
      const tone = part.rarity === 'legendary' ? C.gold : part.rarity === 'epic' ? '#c4a0ec' : part.rarity === 'rare' ? '#8cc0ee' : C.bright;
      push(icon('part', RX + 29, y + 17, 26, tone));
    }
    const tx = card ? RX + 108 : RX + 74;
    if (fault) push(card ? `<rect x="${RX + 26}" y="${y + 34}" width="16" height="16" rx="4" fill="rgba(18,12,12,0.75)"/>${icon('fault', RX + 28, y + 36, 12, C.red)}` : icon('fault', RX + 24, y + 36, 12, C.red));
    push(t(tx, y + 22, 16, C.bright, escapeXml(fit(part.name.toUpperCase(), card ? 24 : 26)), 'font-weight="700" letter-spacing="1"'));
    wrap(part.text, card ? 32 : 42, 2).forEach((line, li) => push(t(tx, y + 40 + li * 15, 14, C.text, rich(line), '')));
    if (fault) {
      const fl = wrap(fault.text, 42, 2);
      const bh = 10 + 14 * fl.length;
      push(rect(RX + 74, y + 96 - bh, 250, bh, 5, C.redBg, `stroke="${C.red}" stroke-width="1"`));
      fl.forEach((line, li) => push(t(RX + 82, y + 96 - bh + 15 + li * 14, 12.5, C.text, rich(line), '')));
    }
  });
  if (list.length === 0) push(t(RX + 14, 190, 15, C.muted, 'No parts installed.', ''));

  // Turns the white ability glyphs dark teal so they read on the pale orb, like the game's slots.
  const tint = '<filter id="tint"><feColorMatrix type="matrix" values="0 0 0 0 0.2 0 0 0 0 0.29 0 0 0 0 0.32 0 0 0 1 0"/></filter>';
  const defs = `<defs>${opts.fontCss ? `<style>${opts.fontCss}</style>` : ''}${tint}</defs>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" font-family="Rajdhani" font-weight="500">${defs}${parts.join('\n')}</svg>`;
}
