import { describe, expect, it } from 'vitest';
import {
  MAX_TUNING_BOXES,
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
});
