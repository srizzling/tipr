import { describe, expect, it } from 'vitest';
import { gameData } from '../data';
import { emptyTuning, newBuild, setTuning, encodeBuild } from './build';
import { diffBuilds, parseBuildInput } from './compare';

const make = () => {
  const b = newBuild('landspeeder');
  b.styleId = 'firebug';
  b.styleRank = 3;
  b.abilities = ['corrosive-vent', null, null, null];
  b.parts = [{ id: 'thermal-inverter', fault: null }];
  return b;
};

describe('diffBuilds', () => {
  it('reports identical builds', () => {
    expect(diffBuilds(make(), make(), gameData).identical).toBe(true);
  });

  it('finds differences in stats, speed, parts, abilities and faults', () => {
    const a = make();
    const b = make();
    b.tuning = setTuning(emptyTuning(), 'ramjet', 5);
    b.abilities = ['overtaking-surge', null, null, null];
    b.parts = [{ id: 'thermal-inverter', fault: 'acidic-fuel' }, { id: 'scrap-reclaimer', fault: null }];
    const d = diffBuilds(a, b, gameData);
    expect(d.identical).toBe(false);
    expect(d.speed).toEqual({ a: 298, b: 318 });
    expect(d.points).toEqual({ a: 0, b: 1 + 3 + 4 + 6 + 8 });
    expect(d.abilities.onlyA).toEqual(['corrosive-vent']);
    expect(d.abilities.onlyB).toEqual(['overtaking-surge']);
    expect(d.parts.onlyB).toEqual(['scrap-reclaimer']);
    expect(d.faults).toEqual([{ part: 'thermal-inverter', a: null, b: 'acidic-fuel' }]);
  });

  it('lists style traits that only one side has', () => {
    const a = make();
    const b = make();
    b.styleRank = 1;
    expect(diffBuilds(a, b, gameData).traits.onlyA).toEqual(['Firestarter', 'Unlimited Power']);
  });
});

describe('parseBuildInput', () => {
  it('accepts share links, editor links and bare codes', () => {
    const code = encodeBuild(make());
    expect(parseBuildInput(`https://example.com/b/${code}`)?.classId).toBe('landspeeder');
    expect(parseBuildInput(`https://example.com/?b=${code}`)?.classId).toBe('landspeeder');
    expect(parseBuildInput(` ${code} `)?.classId).toBe('landspeeder');
    expect(parseBuildInput('nonsense')).toBeNull();
  });
});
