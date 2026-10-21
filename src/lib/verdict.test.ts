import { describe, expect, it } from 'vitest';
import { gameData } from '../data';
import { emptyTuning, newBuild, setTuning, type Build } from './build';
import { buildVerdict } from './verdict';

const withStats = (classId: string, stats: Partial<Record<string, number>>): Build => {
  const b = newBuild(classId);
  let t = emptyTuning();
  for (const [k, v] of Object.entries(stats)) t = setTuning(t, k as never, v as number);
  b.tuning = t;
  return b;
};

describe('buildVerdict', () => {
  it('roasts an empty build', () => {
    expect(buildVerdict(newBuild('landspeeder'), gameData).line).toMatch(/upgrade|nothing|build/i);
  });

  it('is deterministic for the same build and seed, and rerolls change the joke', () => {
    const b = withStats('landspeeder', { cornering: 7 });
    expect(buildVerdict(b, gameData)).toEqual(buildVerdict(b, gameData));
    const seen = new Set([0, 1, 2, 3, 4, 5].map((s) => buildVerdict(b, gameData, s).title + buildVerdict(b, gameData, s).line));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('spots a pod racer in a trench coat', () => {
    const v = buildVerdict(withStats('skim-speeder', { afterburner: 6 }), gameData);
    expect(v.title).toMatch(/pod racer|skim speeder/i);
    expect(v.line).toContain('6');
  });

  it('spots a Firebug carrying a Frozen fault', () => {
    const b = withStats('landspeeder', { ramjet: 2 });
    b.styleId = 'firebug';
    b.parts = [{ id: 'thermal-inverter', fault: 'frosted-injectors' }];
    expect(buildVerdict(b, gameData).title).toMatch(/cold feet|frostbite/i);
  });

  it('counts faults', () => {
    const b = withStats('landspeeder', {});
    b.parts = ['acidic-fuel', 'frosted-injectors', 'thermal-loop'].map((fault, i) => ({ id: ['thermal-inverter', 'scrap-reclaimer', 'ramjet-power-iv'][i], fault }));
    const titles = ['Held together with hope', 'Charmingly cursed', 'Certified fixer-upper'];
    for (const seed of [0, 1, 2, 3]) expect(titles).toContain(buildVerdict(b, gameData, seed).title);
    // the numbered variants fill in the real count
    const lines = [0, 1, 2, 3, 4, 5, 6, 7].map((seed) => buildVerdict(b, gameData, seed).line);
    expect(lines.some((l) => l.includes('3 faults'))).toBe(true);
  });

  it('never leaves a placeholder or empty text, for any class and a spread of stats', () => {
    for (const cls of gameData.vehicleClasses) {
      for (const stat of ['afterburner', 'ramjet', 'cornering', 'resilience', 'battery', 'maneuvering']) {
        for (const n of [0, 3, 7]) {
          for (const seed of [0, 1, 2]) {
            const v = buildVerdict(withStats(cls.id, { [stat]: n }), gameData, seed);
            expect(v.title.length).toBeGreaterThan(3);
            expect(v.line.length).toBeGreaterThan(10);
            expect(v.title + v.line).not.toMatch(/[{}]|undefined|NaN/);
          }
        }
      }
    }
  });
});
