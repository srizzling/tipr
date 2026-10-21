import { STAT_IDS, type GameData, type StatId } from '../data/types';
import { decodeBuild, topSpeed, totalBoxes, tuningCost, vehicleLevel, type Build } from './build';

/** Accepts a full share link, a /?b= editor link, or a bare code. */
export function parseBuildInput(input: string): Build | null {
  const s = input.trim();
  const m = s.match(/\/b\/([A-Za-z0-9_-]+)/) ?? s.match(/[?&]b=([A-Za-z0-9_-]+)/);
  return decodeBuild(m ? m[1] : s);
}

export function styleTraitNames(build: Build, data: GameData): string[] {
  const style = data.racerStyles.find((s) => s.id === build.styleId);
  return style ? style.ranks.filter((r) => r.rank <= build.styleRank).flatMap((r) => r.traits.map((t) => t.name)) : [];
}

export interface Numeric {
  a: number;
  b: number;
}

export interface OnlyIn<T> {
  onlyA: T[];
  onlyB: T[];
}

export interface BuildDiff {
  sameClass: boolean;
  speed: Numeric;
  level: Numeric;
  points: Numeric;
  stats: { stat: StatId; a: number; b: number }[];
  traits: OnlyIn<string>;
  abilities: OnlyIn<string>;
  parts: OnlyIn<string>;
  /** Parts on both sides whose Fault differs. */
  faults: { part: string; a: string | null; b: string | null }[];
  identical: boolean;
}

const only = <T>(a: T[], b: T[]): OnlyIn<T> => ({
  onlyA: a.filter((x) => !b.includes(x)),
  onlyB: b.filter((x) => !a.includes(x)),
});

const abilityIds = (b: Build) => [...b.abilities, b.crashAbility].filter((x): x is string => !!x);

export function diffBuilds(a: Build, b: Build, data: GameData): BuildDiff {
  const base = (x: Build) => data.vehicleClasses.find((c) => c.id === x.classId);
  const speed = (x: Build) => {
    const c = base(x);
    return c ? topSpeed(c.baseSpeed, x.tuning, c.id === 'podracer') : 0;
  };
  const faultOf = (x: Build, id: string) => x.parts.find((p) => p.id === id)?.fault ?? null;
  const partsA = a.parts.map((p) => p.id);
  const partsB = b.parts.map((p) => p.id);

  const d: BuildDiff = {
    sameClass: a.classId === b.classId,
    speed: { a: speed(a), b: speed(b) },
    level: { a: vehicleLevel(a.tuning), b: vehicleLevel(b.tuning) },
    points: { a: tuningCost(totalBoxes(a.tuning)), b: tuningCost(totalBoxes(b.tuning)) },
    stats: STAT_IDS.map((stat) => ({ stat, a: a.tuning[stat], b: b.tuning[stat] })),
    traits: only(styleTraitNames(a, data), styleTraitNames(b, data)),
    abilities: only(abilityIds(a), abilityIds(b)),
    parts: only(partsA, partsB),
    faults: partsA
      .filter((id) => partsB.includes(id) && faultOf(a, id) !== faultOf(b, id))
      .map((id) => ({ part: id, a: faultOf(a, id), b: faultOf(b, id) })),
    identical: false,
  };
  d.identical =
    d.sameClass &&
    a.styleId === b.styleId &&
    a.styleRank === b.styleRank &&
    d.stats.every((s) => s.a === s.b) &&
    d.abilities.onlyA.length + d.abilities.onlyB.length === 0 &&
    d.parts.onlyA.length + d.parts.onlyB.length === 0 &&
    d.faults.length === 0;
  return d;
}
