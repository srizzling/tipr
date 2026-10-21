// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

/**
 * Dev-server equivalent of public/_redirects: serve the shared-build shell for /b/<code>.
 * @type {import('astro').AstroIntegration}
*/
const sharedBuildRewrite = {
  name: 'shared-build-rewrite',
  hooks: {
    'astro:server:setup': ({ server }) => {
      server.middlewares.use((req, _res, next) => {
        if (req.url?.startsWith('/b/') && !req.url.startsWith('/b/_/')) req.url = '/b/_/';
        next();
      });
    },
  },
};

// https://astro.build/config
export default defineConfig({
  // Absolute URL used for canonical links and Open Graph images. Set SITE_URL when a real domain exists.
  site: process.env.SITE_URL ?? 'https://thisispodracing.pages.dev',
  integrations: [react(), sharedBuildRewrite, sitemap({ filter: (page) => !page.includes('/b/') })],
  // Astro hashes its own inline scripts and styles and emits a Content-Security-Policy <meta> tag.
  security: { csp: true },
  // Fetch a page when the pointer hovers its link, so moving between reference pages feels instant.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
});
