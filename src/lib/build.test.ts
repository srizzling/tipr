import { describe, expect, it } from 'vitest';
import {
  MAX_TUNING_BOXES,
  addAbility,
  placeAbility,
  decodeBuild,
  emptyTuning,
  fitToBudget,
  encodeBuild,
  newBuild,
  setTuning,
  topSpeed,
  totalBoxes,
  tuningCost,
} from './build';

describe('tuning', () => {
  it('costs 163 points to max a vehicle', () => {
    expect(tuningCost(MAX_TUNING_BOXES)).toBe(163);
  });

  it('caps a single stat at 7 boxes', () => {
    expect(setTuning(emptyTuning(), 'ramjet', 10).ramjet).toBe(7);
  });

  it('caps total boxes at 14', () => {
    let t = setTuning(emptyTuning(), 'ramjet', 7);
    t = setTuning(t, 'afterburner', 7);
    t = setTuning(t, 'cornering', 7);
    expect(totalBoxes(t)).toBe(14);
    expect(t.cornering).toBe(0);
  });

  it('respects the point budget', () => {
    // 1+3+4 = 8 points buys 3 boxes; the 4th costs 6 more
    expect(setTuning(emptyTuning(), 'ramjet', 7, 8).ramjet).toBe(3);
    expect(setTuning(emptyTuning(), 'ramjet', 7, 13).ramjet).toBe(3);
    expect(setTuning(emptyTuning(), 'ramjet', 7, 14).ramjet).toBe(4);
  });

  it('trims boxes when the budget drops', () => {
    let t = setTuning(emptyTuning(), 'afterburner', 3);
    t = setTuning(t, 'ramjet', 3);
    expect(tuningCost(totalBoxes(t))).toBe(1 + 3 + 4 + 6 + 8 + 9);
    const fit = fitToBudget(t, 10);
    expect(tuningCost(totalBoxes(fit))).toBeLessThanOrEqual(10);
    expect(totalBoxes(fit)).toBe(3);
    expect(fit.afterburner).toBe(3);
  });

  it('adds 4 km/h per box, 7 for podracers', () => {
    const t = setTuning(emptyTuning(), 'ramjet', 5);
    expect(topSpeed(298, t)).toBe(318);
    expect(topSpeed(451, t, true)).toBe(486);
  });
});

describe('share link', () => {
  it('round-trips', () => {
    const b = newBuild('landspeeder');
    b.styleId = 'firebug';
    b.styleRank = 3;
    b.tuning = setTuning(emptyTuning(), 'ramjet', 6);
    b.abilities = ['corrosive-vent', 'overtaking-surge', null, null];
    b.parts = [
      { id: 'ramjet-power-iv', fault: null },
      { id: 'optimized-surge-iii', fault: 'acidic-fuel' },
    ];
    expect(decodeBuild(encodeBuild(b))).toEqual(b);
  });

  it('rejects garbage', () => {
    expect(decodeBuild('not a build')).toBeNull();
  });

  const enc = (v: unknown) => btoa(JSON.stringify(v)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  it('rejects oversized and non-base64url codes before parsing', () => {
    expect(decodeBuild('A'.repeat(5000))).toBeNull();
    expect(decodeBuild('abc"><script>')).toBeNull();
    expect(decodeBuild('abc def')).toBeNull();
  });

  it('drops ids that are not plain slugs', () => {
    const b = decodeBuild(enc(['landspeeder', '<img src=x>', 1, [0, 0, 0, 0, 0, 0], ['ok-id', '"><b>', null, null], 'Bad Id', ['thermal-inverter', ['x"y', 'acidic-fuel'], ['ok', 'a"b']]]));
    expect(b?.styleId).toBeNull();
    expect(b?.abilities).toEqual(['ok-id', null, null, null]);
    expect(b?.crashAbility).toBeNull();
    expect(b?.parts).toEqual([{ id: 'thermal-inverter', fault: null }, { id: 'ok', fault: null }]);
  });

  it('rejects a class id that is not a slug', () => {
    expect(decodeBuild(enc(['Landspeeder<', null, 1, [0, 0, 0, 0, 0, 0], [], null, []]))).toBeNull();
  });
});

describe('ability placement', () => {
  const crash = (id: string) => id.startsWith('ion-');
  const base = () => {
    const b = newBuild('landspeeder');
    b.abilities = ['vent', 'surge', null, null];
    return b;
  };

  it('puts a new ability in an empty slot', () => {
    expect(placeAbility(base(), 2, 'shield', crash).abilities).toEqual(['vent', 'surge', 'shield', null]);
  });

  it('replaces an occupied slot', () => {
    expect(placeAbility(base(), 0, 'shield', crash).abilities).toEqual(['shield', 'surge', null, null]);
  });

  it('swaps when dragging between occupied slots', () => {
    expect(placeAbility(base(), 1, 'vent', crash).abilities).toEqual(['surge', 'vent', null, null]);
  });

  it('moves into an empty slot and frees the old one', () => {
    expect(placeAbility(base(), 3, 'vent', crash).abilities).toEqual([null, 'surge', null, 'vent']);
  });

  it('keeps crash abilities out of normal slots and the reverse', () => {
    expect(placeAbility(base(), 2, 'ion-blast', crash)).toEqual(base());
    expect(placeAbility(base(), 'crash', 'vent', crash)).toEqual(base());
    expect(placeAbility(base(), 'crash', 'ion-blast', crash).crashAbility).toBe('ion-blast');
  });

  it('adds to the first free slot of the right kind', () => {
    expect(addAbility(base(), 'shield', crash).abilities).toEqual(['vent', 'surge', 'shield', null]);
    const full = { ...base(), abilities: ['a', 'b', 'c', 'd'] };
    expect(addAbility(full, 'shield', crash)).toEqual(full);
    expect(addAbility(base(), 'ion-blast', crash).crashAbility).toBe('ion-blast');
  });
});
