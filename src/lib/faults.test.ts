import { describe, expect, it } from 'vitest';
import { gameData } from '../data';
import { faultGroup } from './faults';

const faults = gameData.parts.filter((p) => p.fault);

describe('faultGroup', () => {
  it('groups by the system a fault affects', () => {
    const g = (id: string) => faultGroup(faults.find((f) => f.id === id)!);
    expect(g('acidic-fuel')).toBe('Afterburner');
    expect(g('thermal-loop')).toBe('Ramjet');
    expect(g('startup-malfunction')).toBe('Race start');
    expect(g('dud-battery')).toBe('Abilities & Energy');
    expect(g('anti-surge-device')).toBe('Boosts');
  });

  it('classifies every Fault in the data', () => {
    expect(faults.length).toBeGreaterThanOrEqual(59);
    const other = faults.filter((f) => faultGroup(f) === 'Other').map((f) => `${f.id}: ${f.text}`);
    expect(other).toEqual([]);
  });
});
