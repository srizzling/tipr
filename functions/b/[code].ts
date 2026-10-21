import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { decodeBuild } from '../../src/lib/build';
import { SECURITY_HEADERS } from '../../src/lib/security-headers';
import { buildSummary } from '../../src/lib/summary';
import { gameData } from '../../src/data';
import { cardId } from '../../src/lib/og-cards';
import { SharedBuild } from '../../src/components/SharedBuild';

interface Env {
  ASSETS: Fetcher;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * GET /b/<code>: serve the static shared-build shell with the build already in it.
 * The page title, link-preview tags and the build itself are filled in on the server, so the page works
 * without JavaScript and chat apps show a proper preview. The React island still takes over in the browser.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, params, env }) => {
  const code = String(params.code);
  const shell = await env.ASSETS.fetch(new URL('/b/_/', request.url));
  const build = decodeBuild(code);

  if (!build || !gameData.vehicleClasses.some((c) => c.id === build.classId)) {
    // Let the client show "Build not found", but tell crawlers and caches the truth.
    return new Response(shell.body, {
      status: 404,
      headers: { ...SECURITY_HEADERS, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  const { title, description } = buildSummary(build, gameData);
  const url = new URL(`/b/${code}`, request.url).toString();
  const markup = renderToStaticMarkup(createElement(SharedBuild, { build, code, data: gameData }));
  // Cards are pre-rendered per class and style at build time (see src/pages/og), so no image work happens here.
  const hasStyle = build.styleId !== null && gameData.racerStyles.some((x) => x.id === build.styleId);
  const image = new URL(`/og/${cardId(build.classId, hasStyle ? build.styleId : null)}.png`, request.url).toString();
  const t = escapeHtml(title);
  const d = escapeHtml(description);

  const response = new HTMLRewriter()
    .on('title', { element: (el) => void el.setInnerContent(title) })
    .on('meta[name="description"]', { element: (el) => void el.setAttribute('content', description) })
    // The shell carries generic tags from the layout; drop them so crawlers only see the build-specific ones.
    .on('meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"]', { element: (el) => void el.remove() })
    .on('head', {
      element: (el) =>
        void el.append(
          [
            `<meta property="og:type" content="website">`,
            `<meta property="og:site_name" content="This Is Pod Racing">`,
            `<meta property="og:title" content="${t}">`,
            `<meta property="og:description" content="${d}">`,
            `<meta property="og:url" content="${escapeHtml(url)}">`,
            `<meta property="og:image" content="${escapeHtml(image)}">`,
            `<meta property="og:image:width" content="1200">`,
            `<meta property="og:image:height" content="630">`,
            `<meta name="twitter:card" content="summary_large_image">`,
            `<meta name="twitter:image" content="${escapeHtml(image)}">`,
            `<meta name="twitter:title" content="${t}">`,
            `<meta name="twitter:description" content="${d}">`,
            // Shared builds are user-made, so keep them out of search results.
            `<meta name="robots" content="noindex">`,
          ].join(''),
          { html: true },
        ),
    })
    .on('div.planner.skeleton', { element: (el) => void el.replace(markup, { html: true }) })
    .transform(new Response(shell.body, shell));

  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  headers.set('cache-control', 'public, max-age=300');
  headers.set('x-robots-tag', 'noindex');
  return new Response(response.body, { status: 200, headers });
};
