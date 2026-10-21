import { Resvg, initWasm } from '@resvg/resvg-wasm';
import wasm from '@resvg/resvg-wasm/index_bg.wasm';
import { decodeBuild } from '../../../src/lib/build';
import { buildCardSvg } from '../../../src/lib/build-card';
import { gameData } from '../../../src/data';

interface Env {
  ASSETS: Fetcher;
  /** Set to "1" to render per-build preview images. Off by default, see below. */
  DYNAMIC_OG?: string;
}

let ready: Promise<{ medium: Uint8Array; bold: Uint8Array }> | undefined;

/**
 * GET /og/b/<code>: a PNG replica of the build screen for link previews.
 *
 * Rasterising takes roughly 40 to 110 ms of CPU, far over the 10 ms limit on Cloudflare's free Workers plan,
 * so this is OFF unless DYNAMIC_OG=1 (needs the paid plan). While it is off, shared builds use the static
 * class and style cards from src/pages/og instead, and this route returns 404.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, params, env, waitUntil }) => {
  if (env.DYNAMIC_OG !== '1') return new Response('Not enabled', { status: 404 });

  const build = decodeBuild(String(params.code));
  if (!build || !gameData.vehicleClasses.some((c) => c.id === build.classId)) return new Response('Not found', { status: 404 });

  // The image only depends on the code, so cache it at the edge and render each build once.
  // `caches.default` is Workers-only; the DOM lib in this project's tsconfig does not know it.
  const cache = (caches as unknown as { default: Cache }).default;
  const key = new Request(new URL(request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;

  ready ??= (async () => {
    await initWasm(wasm);
    const font = async (name: string) => new Uint8Array(await (await env.ASSETS.fetch(new URL(`/fonts/${name}`, request.url))).arrayBuffer());
    return { medium: await font('Rajdhani-Medium.ttf'), bold: await font('Rajdhani-Bold.ttf') };
  })();
  const fonts = await ready;

  const resvg = new Resvg(buildCardSvg(build, gameData), {
    fitTo: { mode: 'width', value: 1200 },
    font: { fontBuffers: [fonts.medium, fonts.bold], defaultFontFamily: 'Rajdhani', loadSystemFonts: false },
  });
  const response = new Response(resvg.render().asPng() as unknown as BodyInit, {
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400', 'x-robots-tag': 'noindex' },
  });
  waitUntil(cache.put(key, response.clone()));
  return response;
};
