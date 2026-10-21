import { describe, expect, it } from 'vitest';
import { gameData } from '../data';
import { cardSvg, defaultCard, fit } from './og-card';
import { allCards, cardId } from './og-cards';
import { renderCardPng } from './og-render';

describe('og cards', () => {
  it('escapes text so game data cannot break the SVG', () => {
    const svg = cardSvg({ ...defaultCard, heading: '<b>&"x"', lines: ["a'b"] });
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('&lt;b&gt;&amp;&quot;x&quot;');
    expect(svg).toContain('a&apos;b');
  });

  it('shortens long text with an ellipsis', () => {
    expect(fit('abcdefghij', 5)).toBe('abcd…');
    expect(fit('abc', 5)).toBe('abc');
  });

  it('has a card for every class and style, plus none and default', () => {
    const ids = new Set(allCards(gameData).map((c) => c.id));
    expect(ids.size).toBe(1 + gameData.vehicleClasses.length * (1 + gameData.racerStyles.length));
    expect(ids.has('default')).toBe(true);
    expect(ids.has(cardId('landspeeder', 'firebug'))).toBe(true);
    expect(ids.has(cardId('podracer', null))).toBe(true);
  });

  it('renders a 1200x630 PNG', async () => {
    const card = allCards(gameData).find((c) => c.id === 'landspeeder-firebug')!.card;
    const png = await renderCardPng(card);
    expect([...png.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const view = new DataView(png.buffer, png.byteOffset);
    expect(view.getUint32(16)).toBe(1200);
    expect(view.getUint32(20)).toBe(630);
    expect(png.length).toBeGreaterThan(5000);
  });
});
