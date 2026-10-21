import { describe, expect, it } from 'vitest';
import { gameData as d } from '../data';
import { decodeBuild } from './build';
import { abilityFamilies, kwLinks, partFamily, plannerLink, stylesStartingWith, termUsage } from './ref';

describe('kwLinks', () => {
  it('links known keywords to their glossary page', () => {
    const html = kwLinks('While Burning, gain Overcharged.', d.glossary);
    expect(html).toContain('<a class="kw" href="/glossary/burning/">Burning</a>');
    expect(html).toContain('>Overcharged</a>');
  });

  it('escapes everything else, so game text can never inject markup', () => {
    const html = kwLinks('<img src=x onerror=alert(1)> & "quotes" Burning', d.glossary);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;quotes&quot;');
  });

  it('leaves text without keywords alone', () => {
    expect(kwLinks('nothing to see', d.glossary)).toBe('nothing to see');
  });
});

describe('plannerLink', () => {
  it('opens the planner with the style and ability already chosen', () => {
    const url = plannerLink({ styleId: 'firebug', styleRank: 3, abilities: ['flame-vent', null, null, null] });
    const b = decodeBuild(new URL(url, 'https://x.test').searchParams.get('b')!);
    expect(b?.styleId).toBe('firebug');
    expect(b?.abilities[0]).toBe('flame-vent');
    expect(b?.classId).toBe('landspeeder');
  });

  it('can start on another vehicle class', () => {
    const b = decodeBuild(new URL(plannerLink({}, 'skim-speeder'), 'https://x.test').searchParams.get('b')!);
    expect(b?.classId).toBe('skim-speeder');
  });
});

describe('reference data helpers', () => {
  it('groups abilities into families in tier order, normal before crash', () => {
    const families = abilityFamilies(d.abilities);
    expect(families.length).toBe(9);
    const vent = families.find((f) => f.family === 'vent')!;
    expect(vent.list.map((a) => a.tier)).toEqual([...vent.list.map((a) => a.tier)].sort());
    expect(families.at(-1)!.root.crash).toBe(true);
  });

  it('finds the styles that start with an ability', () => {
    const flame = d.abilities.find((a) => a.id === 'flame-vent')!;
    expect(stylesStartingWith(flame, d.racerStyles).map((s) => s.id)).toContain('firebug');
  });

  it('lists the tiers of a part in order', () => {
    const ramjet = d.parts.find((p) => p.id === 'ramjet-power-iv')!;
    expect(partFamily(ramjet, d.parts).map((p) => p.tier)).toEqual([1, 2, 3, 4]);
  });

  it('finds where a keyword is used', () => {
    const burning = d.glossary.find((g) => g.name === 'Burning')!;
    const used = termUsage(burning, d);
    expect(used.parts.length).toBeGreaterThan(0);
    expect(used.traits.some((t) => t.style.id === 'firebug')).toBe(true);
    expect(used.faults.every((f) => f.fault)).toBe(true);
  });
});
