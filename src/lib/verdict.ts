import { STAT_IDS, type GameData, type StatId } from '../data/types';
import { MAX_TUNING_BOXES, encodeBuild, totalBoxes, type Build } from './build';

export interface Verdict {
  /** Short, shareable headline, e.g. "Pod racer in a trench coat". */
  title: string;
  /** One-line roast that explains the title. */
  line: string;
}

const STAT_NAMES: Record<Exclude<StatId, 'maneuvering'>, string> = {
  afterburner: 'Afterburner',
  ramjet: 'Ramjet',
  cornering: 'Cornering',
  resilience: 'Resilience',
  battery: 'Battery',
};

interface Facts {
  classId: string;
  styleId: string | null;
  boxes: number;
  stats: Record<StatId, number>;
  top: StatId;
  topName: string;
  topShare: number;
  abilities: number;
  abilityIds: string[];
  parts: number;
  faults: number;
  faultText: string;
}

interface Rule {
  id: string;
  when: (f: Facts) => boolean;
  titles: string[];
  /** {n} is the number that triggered the rule, {stat} the dominant stat, {faults} and {boxes} as named. */
  lines: string[];
  n?: (f: Facts) => number;
}

// Ordered most specific first. All jokes are original; none quote the films or the game.
const RULES: Rule[] = [
  {
    id: 'empty',
    when: (f) => f.boxes === 0 && f.parts === 0 && f.abilities === 0 && !f.styleId,
    titles: ['Fresh off the lot', 'Stock and proud', 'Blank canvas, no brush'],
    lines: ['Zero upgrades. The vehicle is doing its best.', 'Nothing installed, so nothing to blame.', 'Technically a build. Technically.'],
  },
  {
    id: 'trench-coat',
    when: (f) => f.classId === 'skim-speeder' && f.stats.afterburner >= 5,
    n: (f) => f.stats.afterburner,
    titles: ['Pod racer in a trench coat', 'Skim speeder with a secret'],
    lines: ['Afterburner {n} on a skim speeder. The pod racers have noticed.', 'Afterburner {n} and a skim speeder body. Nobody is fooled.'],
  },
  {
    id: 'cold-feet',
    when: (f) => f.styleId === 'firebug' && /frozen/.test(f.faultText),
    titles: ['Cold feet', 'A Firebug with frostbite'],
    lines: ['A Firebug carrying a Frozen fault. The thermostat has opinions.', 'Born to burn, lovingly refrigerated.'],
  },
  {
    id: 'identity-crisis',
    when: (f) => f.styleId === 'ice-cold' && /burning/.test(f.faultText),
    titles: ['Identity crisis', 'Ice Cold, on fire'],
    lines: ['Ice Cold style, Burning fault. Nobody knows what temperature this is.', 'Chilled on the outside, on fire on the inside.'],
  },
  {
    id: 'cursed',
    when: (f) => f.faults >= 3,
    n: (f) => f.faults,
    titles: ['Held together with hope', 'Charmingly cursed', 'Certified fixer-upper'],
    lines: ['{n} faults and counting. Tape sold separately.', '{n} faults. Every race is a surprise.', 'It runs. Please do not ask how.'],
  },
  {
    id: 'fire-hazard',
    when: (f) => f.stats.ramjet >= 6 && !f.abilityIds.some((id) => id.includes('vent')),
    n: (f) => f.stats.ramjet,
    titles: ['Fire hazard', 'Redline enthusiast', 'Smells like Ramjet'],
    lines: ['Ramjet {n} and no vent. Redline is a lifestyle.', 'Ramjet {n}, no way to cool down. Bold.'],
  },
  {
    id: 'gas-pedal',
    when: (f) => f.stats.afterburner >= 6,
    n: (f) => f.stats.afterburner,
    titles: ['Never lifts off the gas', 'Afterburner addict'],
    lines: ['Afterburner {n}. Brakes are a rumour.', 'Afterburner {n}. The tank is a suggestion.'],
  },
  {
    id: 'corners',
    when: (f) => f.stats.cornering >= 6,
    n: (f) => f.stats.cornering,
    titles: ['Takes corners personally', 'Turns on a credit'],
    lines: ['Cornering {n}. Straights are for other people.', 'Cornering {n}. Walls feel threatened.'],
  },
  {
    id: 'bumper',
    when: (f) => f.stats.resilience >= 6,
    n: (f) => f.stats.resilience,
    titles: ['Bumper car energy', 'Built for contact'],
    lines: ['Resilience {n}. Getting hit is a feature.', 'Resilience {n}. Other racers are the obstacle course.'],
  },
  {
    id: 'no-plans',
    when: (f) => f.stats.battery >= 6 && f.abilities === 0,
    n: (f) => f.stats.battery,
    titles: ['All dressed up, nowhere to go', 'Full battery, no plans'],
    lines: ['Battery {n} and no abilities. Very charged, very idle.', 'All that Energy and nothing to spend it on.'],
  },
  {
    id: 'pure-skill',
    when: (f) => f.abilities === 0 && f.boxes >= 10,
    titles: ['Pure skill (allegedly)', 'Abilities are for people who plan'],
    lines: ['Heavy tuning, no abilities. Confidence is the real upgrade.', 'No abilities equipped. The driver is the ability.'],
  },
  {
    id: 'maxed',
    when: (f) => f.boxes >= MAX_TUNING_BOXES,
    n: (f) => f.boxes,
    titles: ['Maxed out', 'No regrets, no respec'],
    lines: ['All {n} tuning boxes spent. Commitment issues: none.', 'Every Tuning Point accounted for.'],
  },
  {
    id: 'well-kept',
    when: (f) => f.parts >= 4 && f.faults === 0,
    titles: ['Suspiciously well maintained', 'Mechanic of the month'],
    lines: ['Four parts, zero faults. Is this a trap?', 'Not a single fault. Someone has been reading the manual.'],
  },
  {
    id: 'podracer',
    when: (f) => f.classId === 'podracer',
    titles: ['Dust and vibes', 'Two engines, one bad idea'],
    lines: ['A real pod racer. Everything else is just a bike with ambition.', 'Podracer build. Maximum noise, minimum safety.'],
  },
  {
    id: 'bike',
    when: (f) => f.classId === 'speeder-bike',
    titles: ['Wind in your helmet', 'Fast and exposed'],
    lines: ['Speeder bike build. Seatbelts were not consulted.', 'Zero body panels, one big dream.'],
  },
  {
    id: 'one-trick',
    when: (f) => f.boxes >= 6 && f.topShare >= 0.7,
    titles: ['One-trick pony', 'All eggs, one basket'],
    lines: ['Almost everything in {stat}. Balance is for other builds.', '{stat} or nothing. At least it is a plan.'],
  },
  {
    id: 'balanced',
    when: (f) => f.boxes >= 6 && Math.max(...STAT_IDS.map((s) => f.stats[s])) - Math.min(...STAT_IDS.map((s) => f.stats[s])) <= 1,
    titles: ['Well rounded', 'Perfectly balanced, as nobody asked'],
    lines: ['Every stat about the same. Nothing to brag about, nothing to fix.', 'Even spread across the board. The accountant of builds.'],
  },
  {
    id: 'loaded',
    when: (f) => f.parts >= 3 && f.abilities >= 3,
    titles: ['Fully loaded', 'Gadget goblin'],
    lines: ['Parts and abilities everywhere. There is a button for everything.', 'More gadgets than a market stall.'],
  },
];

const FALLBACK: Omit<Rule, 'id' | 'when'> = {
  titles: ['Perfectly reasonable', 'A sensible build', 'The control group'],
  lines: ['Nothing wild here. Suspicious.', 'A normal build. The racers are relieved.', 'Solid, safe and mildly smug.'],
};

/** Small stable hash so a given build always gets the same joke unless the seed changes. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function factsOf(build: Build, data: GameData): Facts {
  const stats = build.tuning;
  const boxes = totalBoxes(stats);
  const top = [...STAT_IDS].sort((a, b) => stats[b] - stats[a])[0];
  const cls = data.vehicleClasses.find((c) => c.id === build.classId);
  const faultText = build.parts
    .map((p) => data.parts.find((x) => x.id === p.fault)?.text ?? '')
    .join(' ')
    .toLowerCase();
  return {
    classId: build.classId,
    styleId: build.styleId,
    boxes,
    stats,
    top,
    topName: top === 'maneuvering' ? (cls?.maneuveringName ?? 'Maneuvering') : STAT_NAMES[top],
    topShare: boxes ? stats[top] / boxes : 0,
    abilities: [...build.abilities, build.crashAbility].filter(Boolean).length,
    abilityIds: [...build.abilities, build.crashAbility].filter((x): x is string => !!x),
    parts: build.parts.length,
    faults: build.parts.filter((p) => p.fault).length,
    faultText,
  };
}

/** A funny title and roast for a build. `seed` picks a different joke from the same rule (the reroll button). */
export function buildVerdict(build: Build, data: GameData, seed = 0): Verdict {
  const f = factsOf(build, data);
  const rule: Omit<Rule, 'id' | 'when'> = RULES.find((r) => r.when(f)) ?? FALLBACK;
  const h = hash(`${encodeBuild(build)}:${seed}`);
  const fill = (s: string) =>
    s
      .replaceAll('{n}', String(rule.n?.(f) ?? f.boxes))
      .replaceAll('{stat}', f.topName)
      .replaceAll('{boxes}', String(f.boxes))
      .replaceAll('{faults}', String(f.faults));
  return { title: rule.titles[h % rule.titles.length], line: fill(rule.lines[(h >>> 8) % rule.lines.length]) };
}
