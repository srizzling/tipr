import { REPORT_HIDE_AT, REPORTS_PER_HOUR } from '../../../../src/lib/board';
import { edgeCache, firstPageKey, json, logAction, overLimit, sameOrigin, visitorKey, type Env } from '../../_shared';

/**
 * POST /api/builds/<id>/report: flag a link. Each visitor counts once per build, and the entry drops off the board
 * (and stays off) as soon as REPORT_HIDE_AT different visitors have reported it.
 */
export const onRequestPost: PagesFunction<Env, 'id'> = async ({ request, params, env, waitUntil }) => {
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);

  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return json({ error: 'No such build.' }, 404);

  const who = await visitorKey(request);
  if (await overLimit(env.DB, 'report', who, REPORTS_PER_HOUR)) {
    return json({ error: 'Too many reports. Try again in an hour.' }, 429, { 'retry-after': '3600' });
  }

  const [, , added, counted] = await env.DB.batch([
    ...logAction(env.DB, 'report', who),
    // Only inserts when the build exists, so reporting a made-up id changes nothing.
    env.DB.prepare('INSERT OR IGNORE INTO reports (build_id, reporter) SELECT id, ?2 FROM builds WHERE id = ?1').bind(id, who),
    env.DB.prepare(
      `UPDATE builds
         SET reports = (SELECT COUNT(*) FROM reports WHERE build_id = ?1),
             hidden  = (SELECT COUNT(*) FROM reports WHERE build_id = ?1) >= ?2
       WHERE id = ?1`,
    ).bind(id, REPORT_HIDE_AT),
  ]);
  if (counted.meta.changes === 0) return json({ error: 'No such build.' }, 404);
  if (added.meta.changes > 0) waitUntil(edgeCache().delete(firstPageKey(request)));
  return json({ ok: true });
};
