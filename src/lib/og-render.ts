import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { CARD_WIDTH, cardSvg, type CardContent } from './og-card';

let ready: Promise<{ medium: Uint8Array; bold: Uint8Array }> | undefined;

/** Loads the wasm renderer and fonts once per process (build time only, never in the Worker). */
function load() {
  ready ??= (async () => {
    // Resolved from the project root: this module is bundled during `astro build`, so import.meta.url is not the source path.
    const require = createRequire(join(process.cwd(), 'package.json'));
    const wasm = await readFile(require.resolve('@resvg/resvg-wasm/index_bg.wasm'));
    await initWasm(wasm);
    const font = (name: string) => readFile(join(process.cwd(), 'public/fonts', name)).then((b) => new Uint8Array(b));
    return { medium: await font('Rajdhani-Medium.ttf'), bold: await font('Rajdhani-Bold.ttf') };
  })();
  return ready;
}

export async function renderCardPng(card: CardContent): Promise<Uint8Array> {
  return renderSvgPng(cardSvg(card));
}

export async function renderSvgPng(svg: string): Promise<Uint8Array> {
  const fonts = await load();
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: CARD_WIDTH },
    font: { fontBuffers: [fonts.medium, fonts.bold], defaultFontFamily: 'Rajdhani', loadSystemFonts: false },
  });
  return resvg.render().asPng();
}
