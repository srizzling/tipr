import { gameData } from '../data';
import type { Build } from './build';
import type { Verdict } from './verdict';
import { buildCardSvg } from './build-card';
import { artUrlsFor, mimeOf, toBase64 } from './game-art';
import { CARD_HEIGHT, CARD_WIDTH } from './og-card';
import bold from '../../public/fonts/Rajdhani-Bold.woff2?inline';
import medium from '../../public/fonts/Rajdhani-Medium.woff2?inline';

/**
 * Draws the build screen to a PNG in the browser (no server, no upload). Loaded on demand, because the fonts
 * are embedded as data: URLs: an SVG drawn as an image cannot fetch the page's own fonts.
 */
const fontCss = `@font-face{font-family:Rajdhani;font-weight:500;src:url(${medium}) format('woff2')}@font-face{font-family:Rajdhani;font-weight:700;src:url(${bold}) format('woff2')}`;

/** Fetches the build's art from our own server and turns it into data: URLs so the SVG can carry it. */
async function loadArt(build: Build): Promise<Record<string, string>> {
  const entries = await Promise.all(
    artUrlsFor(build, gameData).map(async (url): Promise<[string, string] | null> => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return [url, `data:${mimeOf(url)};base64,${toBase64(new Uint8Array(await res.arrayBuffer()))}`];
      } catch {
        return null; // a missing image falls back to our own icon
      }
    }),
  );
  return Object.fromEntries(entries.filter((e): e is [string, string] => e !== null));
}

export async function buildPng(build: Build, verdict?: Verdict, scale = 2): Promise<Blob> {
  const svg = buildCardSvg(build, gameData, { fontCss, verdict, images: await loadArt(build) });
  const img = new Image();
  // A data: URL (not blob:) so the CSP img-src 'self' data: still applies.
  const bytes = new TextEncoder().encode(svg);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  img.src = `data:image/svg+xml;base64,${btoa(binary)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH * scale;
  canvas.height = CARD_HEIGHT * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the image'))), 'image/png'));
}

export async function saveBuildImage(build: Build, verdict?: Verdict, filename = 'tipr-build.png') {
  const blob = await buildPng(build, verdict);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Copies the image to the clipboard so it can be pasted straight into Discord or Reddit. */
export async function copyBuildImage(build: Build, verdict?: Verdict) {
  const blob = await buildPng(build, verdict);
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
