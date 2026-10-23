import { SECURITY_HEADERS } from '../../src/lib/security-headers';

export interface Env {
  /** D1 database for the builds board (see wrangler.jsonc and migrations/). */
  DB: D1Database;
}

/** Pages only routes files that export onRequest*, so this helper module is not a route. */
export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...SECURITY_HEADERS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

/** `caches.default` is Workers-only; the DOM lib in this project's tsconfig does not know it. */
export const edgeCache = (): Cache => (caches as unknown as { default: Cache }).default;

/** Where the first page of the list is cached, so a write can drop it. */
export const firstPageKey = (request: Request) => new Request(new URL('/api/builds', request.url).toString());

/** A short one-way hash of the visitor's IP: enough to rate-limit and count one report per person, not to find anyone. */
export async function visitorKey(request: Request): Promise<string> {
  const ip = request.headers.get('cf-connecting-ip') ?? 'local';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  return [...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Only our own pages may write. Browsers always send Origin on a POST. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return origin === null || origin === new URL(request.url).origin;
}

const HOUR = 3600;
export const now = () => Math.floor(Date.now() / 1000);

/** True if this visitor already did `limit` of `kind` in the last hour. */
export async function overLimit(db: D1Database, kind: 'submit' | 'report', who: string, limit: number): Promise<boolean> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM actions WHERE kind = ?1 AND who = ?2 AND at > ?3')
    .bind(kind, who, now() - HOUR)
    .first<{ n: number }>();
  return (row?.n ?? 0) >= limit;
}

/** The statements that log one action and prune old log rows. Add them to the same batch as the write. */
export const logAction = (db: D1Database, kind: 'submit' | 'report', who: string): D1PreparedStatement[] => [
  db.prepare('INSERT INTO actions (kind, who, at) VALUES (?1, ?2, ?3)').bind(kind, who, now()),
  db.prepare('DELETE FROM actions WHERE at < ?1').bind(now() - HOUR),
];
