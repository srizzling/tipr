import type { Ability, GameData, Part, StatId } from '../data/types';
import type { Build } from './build';

/**
 * The game's own art (ability glyphs, stat glyphs, part cards), self-hosted under public/game/.
 * It belongs to its owners, so everything that uses it goes through this file: set USE_GAME_ART to false and the
 * site falls back to our original line icons everywhere (page, share image and link previews). See public/game/NOTICE.md.
 */
export const USE_GAME_ART = true;

export type StatArt = StatId | 'speed';

export const statArtUrl = (stat: StatArt): string | null => (USE_GAME_ART ? `/game/stats/${stat}.png` : null);
export const abilityArtUrl = (a: Pick<Ability, 'icon'>): string | null => (USE_GAME_ART && a.icon ? `/game/abilities/${a.icon}.png` : null);
export const partArtUrl = (p: Pick<Part, 'icon'>): string | null => (USE_GAME_ART && p.icon ? `/game/parts/${p.icon}.jpg` : null);

/** Every image a build's share image needs, so they can be fetched and embedded before drawing. */
export function artUrlsFor(build: Build, data: GameData): string[] {
  if (!USE_GAME_ART) return [];
  const urls = new Set<string>();
  for (const stat of ['speed', 'afterburner', 'ramjet', 'cornering', 'resilience', 'battery', 'maneuvering'] as const) {
    urls.add(statArtUrl(stat)!);
  }
  for (const id of [...build.abilities, build.crashAbility]) {
    const a = data.abilities.find((x) => x.id === id);
    const u = a && abilityArtUrl(a);
    if (u) urls.add(u);
  }
  for (const p of build.parts) {
    const part = data.parts.find((x) => x.id === p.id);
    const u = part && partArtUrl(part);
    if (u) urls.add(u);
  }
  return [...urls];
}

/** Encodes bytes as base64 without blowing the call stack on big arrays. */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export const mimeOf = (url: string) => (url.endsWith('.png') ? 'image/png' : 'image/jpeg');
