import type { APIRoute } from 'astro';

// Built from the configured site URL so it stays right when the domain changes.
export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://tipr.pages.dev');
  return new Response(
    [
      'User-agent: *',
      'Allow: /',
      '# Shared builds are user-made, not worth indexing',
      'Disallow: /b/',
      '',
      `Sitemap: ${new URL('/sitemap-index.xml', base)}`,
      '',
    ].join('\n'),
    { headers: { 'content-type': 'text/plain; charset=utf-8' } },
  );
};
