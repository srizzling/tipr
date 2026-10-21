/**
 * Security headers sent on every response. Astro's own <meta> CSP covers script and style hashes; the
 * header CSP below adds the directives a <meta> tag cannot set (frame-ancestors) and locks down the rest.
 * It deliberately has no default-src or script-src, because a header policy without hashes would block
 * Astro's hashed inline scripts (both policies apply).
 *
 * public/_headers serves these for static files and functions/b/[code].ts for the Pages Function,
 * because _headers does not apply to Function responses. A test keeps the two in sync.
 * When ads or analytics are added, extend script-src, connect-src and img-src here deliberately.
 */
export const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy':
    "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; connect-src 'self'; font-src 'self'",
} as const;
