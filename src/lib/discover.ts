import entries from '../data/discover.json';
import { encodeBuild, type Build } from './build';

/**
 * Builds spotted in community posts, picked and checked by hand (not scraped on a schedule), shown on the builds board
 * tagged as coming from Reddit. Each one credits its
 * author and links to the original post. `tuning` is the green boxes on the build screen (Tuning Points, 14 in all) and
 * `bonus` the white ones (extra boxes), counted by eye from the screenshot, so a box or two may be off.
 */
export interface DiscoverEntry {
  id: string;
  title: string;
  /** Reddit username, without the u/ */
  author: string;
  /** Permalink of the post */
  post: string;
  /** Date of the post, YYYY-MM-DD */
  posted: string;
  /** What the post itself shows, which labels the click-to-load embed button */
  media: 'video' | 'image';
  /** Our own one-line summary of the post */
  note: string;
  build: Build;
}

export const discoverEntries = entries as DiscoverEntry[];

/** Share code for opening an entry in the planner. */
export const discoverCode = (e: DiscoverEntry): string => encodeBuild(e.build);

const POST_PATH = /^\/r\/[A-Za-z0-9_]+\/comments\/[a-z0-9]+\/[a-z0-9_]*\/?$/;

/**
 * Where Reddit serves a post for embedding (this is what its own embed script frames). Null for anything that is not an
 * ordinary post permalink, so only Reddit's embed domain can ever end up in a frame.
 */
export function redditEmbedUrl(post: string): string | null {
  let url: URL;
  try {
    url = new URL(post);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname !== 'www.reddit.com' || url.search || url.hash || !POST_PATH.test(url.pathname)) return null;
  return `https://embed.reddit.com${url.pathname}?embed=true&theme=dark&showmedia=true&showmore=false&showedits=false`;
}
