/** Link-preview card (1200x630) as SVG. Rasterised to PNG at build time by src/pages/og/[card].png.ts. */

export interface CardContent {
  /** Big heading on the left, e.g. the vehicle class. */
  heading: string;
  /** Small label above the heading. */
  label: string;
  /** Second line under the heading, e.g. the maneuvering stat. */
  sub?: string;
  /** Right panel label and title, e.g. RACER STYLE / Firebug. */
  panelLabel: string;
  panelTitle: string;
  /** Up to four short lines in the right panel (trait names). */
  lines: string[];
}

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

const COLORS = {
  bg: '#0f1719',
  paper: '#ecebe3',
  paperDark: '#dcdcd2',
  slate: '#2e464b',
  slate3: '#263b40',
  ink: '#101a1d',
  text: '#dfe8e6',
  muted: '#92a9a8',
  gold: '#e8b04a',
};

export const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** resvg does not wrap text, so keep every line short enough to fit its panel. */
export const fit = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

export function cardSvg(c: CardContent): string {
  const lines = c.lines.slice(0, 4);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" font-family="Rajdhani">
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${COLORS.bg}"/>
  <rect x="40" y="40" width="1120" height="550" rx="20" fill="${COLORS.paper}"/>
  <text x="80" y="130" font-size="84" font-weight="700" fill="${COLORS.ink}"><tspan>/</tspan>BUILD</text>
  <text x="1120" y="118" font-size="32" font-weight="700" fill="${COLORS.ink}" text-anchor="end" letter-spacing="3">THIS IS POD RACING</text>
  <rect x="60" y="160" width="1080" height="410" rx="14" fill="${COLORS.paperDark}"/>

  <rect x="80" y="180" width="440" height="370" rx="12" fill="${COLORS.slate}"/>
  <text x="108" y="226" font-size="24" font-weight="500" fill="${COLORS.muted}" letter-spacing="4">${escapeXml(fit(c.label.toUpperCase(), 22))}</text>
  <text x="108" y="320" font-size="62" font-weight="700" fill="${COLORS.text}">${escapeXml(fit(c.heading, 14))}</text>
  ${c.sub ? `<text x="108" y="372" font-size="34" font-weight="500" fill="${COLORS.muted}">${escapeXml(fit(c.sub, 26))}</text>` : ''}

  <rect x="540" y="180" width="580" height="370" rx="12" fill="${COLORS.slate}"/>
  <text x="572" y="226" font-size="24" font-weight="500" fill="${COLORS.muted}" letter-spacing="5">${escapeXml(c.panelLabel.toUpperCase())}</text>
  <text x="572" y="304" font-size="64" font-weight="700" fill="${COLORS.gold}">${escapeXml(fit(c.panelTitle, 20))}</text>
  ${lines
    .map(
      (l, i) =>
        `<rect x="572" y="${336 + i * 52}" width="516" height="42" rx="8" fill="${COLORS.slate3}"/><text x="592" y="${366 + i * 52}" font-size="28" font-weight="500" fill="${COLORS.text}">${escapeXml(fit(l, 34))}</text>`,
    )
    .join('\n  ')}
</svg>`;
}

export const defaultCard: CardContent = {
  label: 'Galactic Racer',
  heading: 'Build planner',
  sub: 'Plan, share and compare',
  panelLabel: 'Pick your',
  panelTitle: 'Style + parts',
  lines: ['Vehicle class and tuning', 'Racer style and traits', 'Abilities and parts'],
};
