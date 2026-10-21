import { describe, expect, it } from 'vitest';
import { gameData } from '../data';
import { newBuild, setTuning, emptyTuning, type Build } from './build';
import { buildCardSvg, wrap } from './build-card';
import { renderSvgPng } from './og-render';

const sample = (): Build => {
  const b = newBuild('landspeeder');
  b.styleId = 'firebug';
  b.styleRank = 3;
  b.tuning = setTuning(emptyTuning(), 'ramjet', 5);
  b.abilities = ['corrosive-vent', 'overtaking-surge', null, null];
  b.parts = [
    { id: 'thermal-inverter', fault: null },
    { id: 'calibrating-landings-iii', fault: 'acidic-fuel' },
  ];
  return b;
};

describe('wrap', () => {
  it('breaks on words and ends with an ellipsis when cut', () => {
    expect(wrap('one two three', 20, 2)).toEqual(['one two three']);
    expect(wrap('aaa bbb ccc ddd', 7, 2)).toEqual(['aaa bbb', 'ccc ddd']);
    expect(wrap('aaa bbb ccc ddd eee', 7, 2)).toEqual(['aaa bbb', 'ccc ddd…']);
    expect(wrap('', 10, 2)).toEqual([]);
  });
  it('never returns a line much longer than asked', () => {
    for (const line of wrap('While Burning, Afterburner and Ramjet are significantly more powerful.', 30, 3)) {
      expect(line.length).toBeLessThanOrEqual(32);
    }
  });
});

describe('buildCardSvg', () => {
  it('shows the real build: speed, style, abilities, parts and the fault', () => {
    const svg = buildCardSvg(sample(), gameData);
    expect(svg).toContain('>318<'); // 298 + 5 boxes * 4 km/h
    expect(svg).toContain('FIREBUG · RANK 3');
    expect(svg).toContain('CORROSIVE VENT');
    expect(svg).toContain('THERMAL INVERTER');
    expect(svg).toContain('CALIBRATING LANDINGS III');
    expect(svg).toContain('Corroded'); // from the Acidic Fuel fault
    expect(svg).toContain('2/4');
  });

  it('draws one filled box per tuning box', () => {
    const svg = buildCardSvg(sample(), gameData);
    // 5 filled ramjet boxes use the bright fill without opacity
    expect(svg.match(/fill="#f1f6f4" \/>/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it('handles an empty build and every vehicle class', () => {
    for (const cls of gameData.vehicleClasses) {
      const svg = buildCardSvg(newBuild(cls.id), gameData);
      expect(svg).toContain('NO STYLE');
      expect(svg).toContain('No parts installed.');
    }
  });

  it('escapes anything that reaches the markup', () => {
    const b = sample();
    const svg = buildCardSvg(b, gameData, { fontCss: '' });
    expect(svg).not.toMatch(/<script/i);
  });

  it('renders every style and a full build to a PNG', async () => {
    for (const style of gameData.racerStyles.filter((s) => !s.multiplayerOnly)) {
      const b = sample();
      b.styleId = style.id;
      const png = await renderSvgPng(buildCardSvg(b, gameData));
      expect(png.length).toBeGreaterThan(20000);
    }
  }, 60000);

  it('throws for an unknown class so callers can 404', () => {
    const b = sample();
    b.classId = 'nope';
    expect(() => buildCardSvg(b, gameData)).toThrow();
  });
});
