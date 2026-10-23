import { PAGE_SIZE, SUBMITS_PER_HOUR, validateSubmission, type BoardEntry } from '../../../src/lib/board';
import vehicleClasses from '../../../src/data/vehicle-classes.json';
import { edgeCache, firstPageKey, json, logAction, now, overLimit, sameOrigin, visitorKey, type Env } from '../_shared';

const isKnownClass = (id: string) => vehicleClasses.some((c) => c.id === id);
const MAX_BODY = 4096;

/**
 * GET /api/builds?before=<id>: the board, newest first, one page at a time.
 * Answers come from the edge cache for a minute, so D1 is read about once a minute per location however busy the page is.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const cache = edgeCache();
  const hit = await cache.match(request);
  if (hit) return hit;

  const before = Number(new URL(request.url).searchParams.get('before'));
  const cursor = Number.isSafeInteger(before) && before > 0 ? before : Number.MAX_SAFE_INTEGER;
  const { results } = await env.DB.prepare(
    'SELECT id, code, url, created_at FROM builds WHERE hidden = 0 AND id < ?1 ORDER BY id DESC LIMIT ?2',
  )
    .bind(cursor, PAGE_SIZE + 1)
    .all<{ id: number; code: string; url: string; created_at: number }>();

  const page = results.slice(0, PAGE_SIZE);
  const entries: BoardEntry[] = page.map((r) => ({ id: r.id, code: r.code, url: r.url, createdAt: r.created_at }));
  const next = results.length > PAGE_SIZE ? page[page.length - 1].id : null;
  const response = json({ entries, next }, 200, { 'cache-control': 'public, max-age=60' });
  waitUntil(cache.put(request, response.clone()));
  return response;
};

/** POST /api/builds { build, video, website }: list a build with a video link straight away. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);

  const text = await request.text();
  let body: { build?: unknown; video?: unknown; website?: unknown };
  try {
    if (text.length > MAX_BODY) throw new Error('too big');
    body = JSON.parse(text);
    if (!body || typeof body !== 'object') throw new Error('not an object');
  } catch {
    return json({ error: 'That request could not be read.' }, 400);
  }

  // A hidden form field that people never see. Bots fill it in; pretend it worked.
  if (typeof body.website === 'string' && body.website !== '') return json({ ok: true, duplicate: false });

  const parsed = validateSubmission(body, isKnownClass);
  if (!parsed.ok) return json({ error: parsed.error }, 422);

  const who = await visitorKey(request);
  if (await overLimit(env.DB, 'submit', who, SUBMITS_PER_HOUR)) {
    return json({ error: 'That is a lot of builds. Try again in an hour.' }, 429, { 'retry-after': '3600' });
  }

  const [, , insert] = await env.DB.batch([
    ...logAction(env.DB, 'submit', who),
    env.DB.prepare('INSERT OR IGNORE INTO builds (code, url, created_at) VALUES (?1, ?2, ?3)').bind(parsed.code, parsed.url, now()),
  ]);
  const duplicate = insert.meta.changes === 0;
  if (!duplicate) waitUntil(edgeCache().delete(firstPageKey(request)));
  return json({ ok: true, duplicate }, duplicate ? 200 : 201);
};
