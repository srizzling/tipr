import type { Ability, GameData, GlossaryTerm, Part, RacerStyle } from '../data/types';
import { encodeBuild, newBuild, type Build } from './build';
import { escapeXml } from './og-card';

/** Link to the planner with a build already filled in (the "Use in a build" buttons on reference pages). */
export const plannerLink = (patch: Partial<Build>, classId = 'landspeeder') => `/?b=${encodeBuild({ ...newBuild(classId), ...patch })}`;

const regexCache = new WeakMap<GlossaryTerm[], RegExp | null>();
function keywordRe(glossary: GlossaryTerm[]): RegExp | null {
  if (!regexCache.has(glossary)) {
    const names = glossary.map((g) => g.name).sort((a, b) => b.length - a.length);
    regexCache.set(glossary, names.length ? new RegExp(`\\b(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'g') : null);
  }
  return regexCache.get(glossary)!;
}

/**
 * Game text as safe HTML where every known keyword links to its glossary page, so reference pages link to each other.
 * The text is escaped first and only our own anchors are added.
 */
export function kwLinks(text: string, glossary: GlossaryTerm[]): string {
  const re = keywordRe(glossary);
  if (!re) return escapeXml(text);
  const byName = new Map(glossary.map((g) => [g.name, g.id]));
  let out = '';
  let last = 0;
  for (const m of text.matchAll(re)) {
    out += escapeXml(text.slice(last, m.index));
    out += `<a class="kw" href="/glossary/${byName.get(m[0])}/">${escapeXml(m[0])}</a>`;
    last = m.index! + m[0].length;
  }
  return out + escapeXml(text.slice(last));
}

/** Where a keyword shows up: abilities, parts (not faults), faults, and racer-style traits. */
export function termUsage(term: GlossaryTerm, data: GameData) {
  const re = new RegExp(`\\b${term.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  return {
    abilities: data.abilities.filter((a) => re.test(a.text)),
    parts: data.parts.filter((p) => !p.fault && re.test(p.text)),
    faults: data.parts.filter((p) => p.fault && re.test(p.text)),
    traits: data.racerStyles.flatMap((style) =>
      [...style.ranks.flatMap((r) => r.traits), ...style.multiplayer]
        .filter((t, i, all) => re.test(t.text) && all.findIndex((x) => x.name === t.name) === i)
        .map((trait) => ({ style, trait })),
    ),
  };
}

/** Abilities grouped by their root ability ("family"), each in tier order. */
export function abilityFamilies(abilities: Ability[]) {
  const map = new Map<string, Ability[]>();
  for (const a of abilities) map.set(a.family, [...(map.get(a.family) ?? []), a]);
  return [...map.entries()]
    .map(([family, list]) => ({ family, root: list.find((a) => a.id === family) ?? list[0], list: list.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name)) }))
    .sort((a, b) => Number(a.root.crash) - Number(b.root.crash) || a.root.name.localeCompare(b.root.name));
}

export const stylesStartingWith = (ability: Ability, styles: RacerStyle[]) => styles.filter((s) => s.startingAbilityId === ability.id);

/** Other tiers of the same part (Ramjet Power I to IV). */
export const partFamily = (part: Part, parts: Part[]) => (part.family ? parts.filter((p) => p.family === part.family && !p.fault).sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0)) : []);

export const RARITY_ORDER = ['legendary', 'epic', 'rare', 'common', 'experimental'] as const;
export const money = (n: number | null) => (n === null ? 'Not sold' : `${n.toLocaleString('en-US')} credits`);
