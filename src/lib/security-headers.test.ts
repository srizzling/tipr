import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SECURITY_HEADERS } from './security-headers';

describe('security headers', () => {
  const file = readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8');

  it('public/_headers matches the shared definition', () => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(file, name).toContain(`  ${name}: ${value}`);
    }
  });

  it('never lets the header CSP block Astro hashed scripts', () => {
    const csp = SECURITY_HEADERS['Content-Security-Policy'];
    expect(csp).not.toMatch(/default-src|script-src/);
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
