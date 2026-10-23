import { STAT_IDS, type StatId } from '../data/types';

/** Cost of the Nth Tuning Point box (1-indexed), same whichever stat it goes into. Sum = 163. */
export const TUNING_STEP_COSTS = [1, 3, 4, 6, 8, 9, 11, 13, 14, 16, 17, 19, 20, 22] as const;
export const MAX_TUNING_BOXES = TUNING_STEP_COSTS.length; // 14, i.e. vehicle level 15
export const MAX_BOXES_PER_STAT = 7; // only the 7 small boxes take Tuning Points
/**
 * Every stat row on the game's build screen has 10 boxes: 7 small and 3 large. Tuning Points fill at most 14 boxes in
 * total (the model above); the rest come from other sources we call "extra boxes" (the screenshots show them in a second
 * colour). Both kinds add the same speed and Energy. See "Tuning boxes" in ROADMAP.md.
 */
export const MAX_STAT_BOXES = 10;
/** The most installed parts we have seen on the game's build screen ("6/6"). Early builds show 4 slots ("3/4"), so the count seems to grow with progress. */
export const MAX_PARTS = 6;
export const ABILITY_SLOTS = 4;
export const KM_H_PER_BOX = 4;
export const PODRACER_KM_H_PER_BOX = 7;
/** Max Energy is 3 at the start plus about 1 per Battery box (community-measured, so treat as an estimate). */
export const BASE_ENERGY = 3;
export const MAX_ENERGY_SCALE = 16;
/** localStorage key holding the planner's current build code, so Compare can offer "my build". */
export const CURRENT_BUILD_KEY = 'tipr:current';

/** An installed part, optionally carrying a Fault (the red drawback line under it in the game). */
export interface InstalledPart {
  id: string;
  fault: string | null;
}

export interface Build {
  classId: string;
  styleId: string | null;
  styleRank: 1 | 2 | 3;
  /** Boxes bought with Tuning Points: at most 14 in total and 7 per stat. */
  tuning: Record<StatId, number>;
  /** Extra boxes from other sources, on top of `tuning`: at most MAX_STAT_BOXES per stat in all. */
  bonus: Record<StatId, number>;
  abilities: (string | null)[]; // ABILITY_SLOTS long
  crashAbility: string | null;
  parts: InstalledPart[]; // <= MAX_PARTS
}

export function emptyTuning(): Record<StatId, number> {
  return Object.fromEntries(STAT_IDS.map((s) => [s, 0])) as Record<StatId, number>;
}

export function newBuild(classId: string): Build {
  return {
    classId,
    styleId: null,
    styleRank: 1,
    tuning: emptyTuning(),
    bonus: emptyTuning(),
    abilities: Array(ABILITY_SLOTS).fill(null),
    crashAbility: null,
    parts: [],
  };
}

/** Tuning boxes and extra boxes added up per stat: what the game counts for speed and Energy. */
export function combinedBoxes(tuning: Record<StatId, number>, bonus: Record<StatId, number>): Record<StatId, number> {
  return Object.fromEntries(STAT_IDS.map((s) => [s, tuning[s] + bonus[s]])) as Record<StatId, number>;
}

/** Drops extra boxes that no longer fit once Tuning Point boxes were added (a stat holds MAX_STAT_BOXES in all). */
export function clampBonus(tuning: Record<StatId, number>, bonus: Record<StatId, number>): Record<StatId, number> {
  return Object.fromEntries(
    STAT_IDS.map((s) => [s, Math.max(0, Math.min(Math.floor(Number(bonus[s]) || 0), MAX_STAT_BOXES - tuning[s]))]),
  ) as Record<StatId, number>;
}

/** Sets a stat's box count to `total` (Tuning Point boxes included) by changing only its extra boxes. */
export function setBonusTotal(tuning: Record<StatId, number>, bonus: Record<StatId, number>, stat: StatId, total: number): Record<StatId, number> {
  return clampBonus(tuning, { ...bonus, [stat]: Math.max(0, Math.floor(total) - tuning[stat]) });
}

export function totalBoxes(tuning: Record<StatId, number>): number {
  return STAT_IDS.reduce((n, s) => n + tuning[s], 0);
}

/** Tuning Points needed to reach `boxes` boxes in total. */
export function tuningCost(boxes: number): number {
  return TUNING_STEP_COSTS.slice(0, boxes).reduce((a, b) => a + b, 0);
}

/** Tuning Points the next box costs, or null once all 14 boxes are filled. */
export function nextBoxCost(tuning: Record<StatId, number>): number | null {
  return TUNING_STEP_COSTS[totalBoxes(tuning)] ?? null;
}

/** Tuning Points still needed to fill every box. */
export function pointsToMax(tuning: Record<StatId, number>): number {
  return tuningCost(MAX_TUNING_BOXES) - tuningCost(totalBoxes(tuning));
}

export function vehicleLevel(tuning: Record<StatId, number>): number {
  return 1 + totalBoxes(tuning);
}

/** Returns a new tuning map with `stat` set to `value`, clamped by per-stat and total limits. */
export function setTuning(
  tuning: Record<StatId, number>,
  stat: StatId,
  value: number,
  budget = Infinity,
): Record<StatId, number> {
  const others = totalBoxes(tuning) - tuning[stat];
  let v = Math.max(0, Math.min(MAX_BOXES_PER_STAT, Math.floor(value)));
  v = Math.min(v, MAX_TUNING_BOXES - others);
  while (v > tuning[stat] && tuningCost(others + v) > budget) v--;
  return { ...tuning, [stat]: Math.max(0, v) };
}

/** Removes boxes (from the last stat backwards) until the build costs no more than `budget` Tuning Points. */
export function fitToBudget(tuning: Record<StatId, number>, budget: number): Record<StatId, number> {
  const t = { ...tuning };
  for (const stat of [...STAT_IDS].reverse()) {
    while (t[stat] > 0 && tuningCost(totalBoxes(t)) > budget) t[stat]--;
  }
  return t;
}

export function maxEnergy(tuning: Record<StatId, number>): number {
  return BASE_ENERGY + tuning.battery;
}

export function topSpeed(baseSpeed: number, tuning: Record<StatId, number>, podracer = false): number {
  return baseSpeed + totalBoxes(tuning) * (podracer ? PODRACER_KM_H_PER_BOX : KM_H_PER_BOX);
}

export type AbilitySlot = number | 'crash';

const abilityAt = (b: Build, slot: AbilitySlot) => (slot === 'crash' ? b.crashAbility : (b.abilities[slot] ?? null));

export function findAbilitySlot(b: Build, id: string): AbilitySlot | null {
  if (b.crashAbility === id) return 'crash';
  const i = b.abilities.indexOf(id);
  return i === -1 ? null : i;
}

export function setAbilitySlot(b: Build, slot: AbilitySlot, id: string | null): Build {
  if (slot === 'crash') return { ...b, crashAbility: id };
  const abilities = [...b.abilities];
  abilities[slot] = id;
  return { ...b, abilities };
}

/**
 * Puts ability `id` into `to`. The ability moves if it is already placed somewhere (or comes from `from`),
 * and whatever was in `to` takes its old place, so dragging between slots swaps them. Crash abilities only go
 * in the crash slot and everything else only in the normal slots; invalid drops return the build unchanged.
 */
export function placeAbility(b: Build, to: AbilitySlot, id: string, isCrash: (id: string) => boolean): Build {
  if (isCrash(id) !== (to === 'crash')) return b;
  const from = findAbilitySlot(b, id);
  if (from === to) return b;
  const displaced = abilityAt(b, to);
  let next = b;
  if (from !== null) next = setAbilitySlot(next, from, displaced);
  return setAbilitySlot(next, to, id);
}

/** Puts `id` in the first empty slot of the right kind, or returns the build unchanged if none is free. */
export function addAbility(b: Build, id: string, isCrash: (id: string) => boolean): Build {
  if (findAbilitySlot(b, id) !== null) return b;
  const slot: AbilitySlot | undefined = isCrash(id)
    ? b.crashAbility === null ? 'crash' : undefined
    : b.abilities.findIndex((a) => a === null) === -1 ? undefined : b.abilities.findIndex((a) => a === null);
  return slot === undefined ? b : setAbilitySlot(b, slot, id);
}

/** Share-link encoding: compact JSON in base64url. */
export function encodeBuild(b: Build): string {
  const compact = [
    b.classId,
    b.styleId,
    b.styleRank,
    STAT_IDS.map((s) => b.tuning[s]),
    b.abilities,
    b.crashAbility,
    b.parts.map((p) => (p.fault ? [p.id, p.fault] : p.id)),
    // Only written when there are extra boxes, so every build without them keeps the code it always had.
    ...(STAT_IDS.some((s) => b.bonus[s] > 0) ? [STAT_IDS.map((s) => b.bonus[s])] : []),
  ];
  return btoa(JSON.stringify(compact)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Share codes are tiny; anything bigger or with other characters is not ours. Keeps hostile input out of JSON.parse and the server. */
export const MAX_CODE_LENGTH = 2048;
const CODE_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Game ids are lowercase slugs. Anything else in a share code is dropped. */
const ID_PATTERN = /^[a-z0-9-]{1,64}$/;
const idOrNull = (v: unknown): string | null => (typeof v === 'string' && ID_PATTERN.test(v) ? v : null);

export function decodeBuild(s: string): Build | null {
  if (s.length > MAX_CODE_LENGTH || !CODE_PATTERN.test(s)) return null;
  try {
    const pad = s.replace(/-/g, '+').replace(/_/g, '/');
    const [classId, styleId, styleRank, boxes, abilities, crashAbility, parts, extra] = JSON.parse(
      atob(pad + '='.repeat((4 - (pad.length % 4)) % 4)),
    );
    if (typeof classId !== 'string' || !ID_PATTERN.test(classId) || !Array.isArray(boxes) || !Array.isArray(abilities) || !Array.isArray(parts)) {
      return null;
    }
    let tuning = emptyTuning();
    STAT_IDS.forEach((stat, i) => {
      tuning = setTuning(tuning, stat, Number(boxes[i]) || 0);
    });
    const bonus = clampBonus(tuning, Object.fromEntries(STAT_IDS.map((stat, i) => [stat, Array.isArray(extra) ? extra[i] : 0])) as Record<StatId, number>);
    return {
      classId,
      styleId: idOrNull(styleId),
      styleRank: [1, 2, 3].includes(styleRank) ? styleRank : 1,
      tuning,
      bonus,
      abilities: Array.from({ length: ABILITY_SLOTS }, (_, i) => idOrNull(abilities[i])),
      crashAbility: idOrNull(crashAbility),
      parts: parts
        .slice(0, MAX_PARTS)
        .map((p: unknown): InstalledPart | null =>
          typeof p === 'string' && ID_PATTERN.test(p)
            ? { id: p, fault: null }
            : Array.isArray(p) && typeof p[0] === 'string' && ID_PATTERN.test(p[0])
              ? { id: p[0], fault: idOrNull(p[1]) }
              : null,
        )
        .filter((p: InstalledPart | null): p is InstalledPart => p !== null),
    };
  } catch {
    return null;
  }
}
