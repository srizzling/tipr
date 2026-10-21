// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

/** Dev-server equivalent of public/_redirects: serve the shared-build shell for /b/<code>. */
const sharedBuildRewrite = {
  name: 'shared-build-rewrite',
  hooks: {
    /** @param {{ server: import('vite').ViteDevServer }} ctx */
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
  integrations: [react(), sharedBuildRewrite],
});
