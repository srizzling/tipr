import { decodeBuild, encodeBuild, MAX_CODE_LENGTH } from './build';

/**
 * The public builds board: a share code plus a link to a video of it. Shared by the Pages Functions (which validate
 * and store) and the browser (which pre-checks the form), so both sides agree on what is acceptable.
 */

/** One row of the board as the API returns it. */
export interface BoardEntry {
  id: number;
  /** Normalised share code, the same one used in /b/<code> links. */
  code: string;
  /** Normalised https link to the video. */
  url: string;
  /** Unix seconds. */
  createdAt: number;
}

/** A link stops being listed once this many different people have reported it. */
export const REPORT_HIDE_AT = 3;
export const SUBMITS_PER_HOUR = 5;
export const REPORTS_PER_HOUR = 30;
export const PAGE_SIZE = 50;
export const MAX_URL_LENGTH = 300;

/** Video sites we accept. Subdomains count (www., m., clips., player.). Add a host here to allow it. */
export const VIDEO_HOSTS = ['youtube.com', 'youtu.be', 'twitch.tv', 'streamable.com', 'medal.tv', 'vimeo.com'] as const;

/** Query parameters that only track where a link was copied from. Dropped so the same video is not listed twice. */
const TRACKING_PARAM = /^(utm_.*|si|pp|feature|fbclid|gclid)$/i;

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const CODE_ONLY = /^[A-Za-z0-9_-]+$/;

export function isVideoHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return VIDEO_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/** Turns what someone pasted into a clean https video link, or null if it is not an accepted one. */
export function normalizeVideoUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!text || text.length > MAX_URL_LENGTH * 2) return null;
  let url: URL;
  try {
    url = new URL(SCHEME.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password || url.port) return null;
  if (!isVideoHost(url.hostname)) return null;
  // A site's front page is not a video.
  if (url.pathname === '/' || url.pathname === '') return null;
  url.protocol = 'https:';
  url.hash = '';
  url.hostname = url.hostname.replace(/^(www|m)\./i, '');
  for (const key of [...url.searchParams.keys()]) if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
  // youtu.be/<id> is the same video as youtube.com/watch?v=<id>; list it once.
  const short = url.hostname.toLowerCase() === 'youtu.be' && url.pathname.match(/^\/([\w-]{6,20})\/?$/)?.[1];
  if (short) {
    url.hostname = 'youtube.com';
    url.pathname = '/watch';
    url.searchParams.set('v', short);
  }
  url.searchParams.sort();
  const out = url.toString();
  return out.length <= MAX_URL_LENGTH ? out : null;
}

/**
 * Accepts a bare share code or a pasted link to a build (/b/<code>, /?b=<code>, /compare?a=<code>) and returns the
 * normalised code, or null if it does not decode to a build. Re-encoding means the same build always has the same code.
 */
export function normalizeBuildCode(raw: unknown, isKnownClass: (classId: string) => boolean): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!text || text.length > MAX_CODE_LENGTH + 200) return null;
  let candidate = text;
  if (!CODE_ONLY.test(text)) {
    try {
      const url = new URL(SCHEME.test(text) ? text : `https://${text}`);
      const fromPath = url.pathname.match(/^\/b\/([^/]+)\/?$/)?.[1];
      candidate = fromPath ?? url.searchParams.get('b') ?? url.searchParams.get('a') ?? '';
    } catch {
      return null;
    }
  }
  const build = decodeBuild(candidate);
  return build && isKnownClass(build.classId) ? encodeBuild(build) : null;
}

export type Submission = { ok: true; code: string; url: string } | { ok: false; error: string };

export function validateSubmission(input: { build?: unknown; video?: unknown }, isKnownClass: (classId: string) => boolean): Submission {
  const code = normalizeBuildCode(input.build, isKnownClass);
  if (!code) return { ok: false, error: "That isn't a build link. Paste the link from the planner's Copy link button." };
  const url = normalizeVideoUrl(input.video);
  if (!url) return { ok: false, error: `The video link must be a page on ${VIDEO_HOSTS.join(', ')}.` };
  return { ok: true, code, url };
}

/** Short host label for the link text, e.g. "youtube.com". */
export function videoHostLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^(www|m)\./, '');
    return host === 'youtu.be' ? 'youtube.com' : host;
  } catch {
    return 'video';
  }
}
