import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gameData } from '../data';
import { newBuild, type Build } from './build';
import { buildCardSvg } from './build-card';
import { USE_GAME_ART, abilityArtUrl, artUrlsFor, partArtUrl, partThumbUrl, statArtUrl } from './game-art';
import { renderSvgPng } from './og-render';
import { readFileSync } from 'node:fs';

const onDisk = (url: string) => existsSync(join(process.cwd(), 'public', url));

describe('game art', () => {
  it('every ability and part with an icon has its file on disk', () => {
    expect(USE_GAME_ART).toBe(true);
    const missing: string[] = [];
    for (const a of gameData.abilities) if (!abilityArtUrl(a) || !onDisk(abilityArtUrl(a)!)) missing.push(`ability ${a.id}`);
    for (const p of gameData.parts) {
      if (!partArtUrl(p) || !onDisk(partArtUrl(p)!)) missing.push(`part ${p.id}`);
      if (!partThumbUrl(p) || !onDisk(partThumbUrl(p)!)) missing.push(`part thumb ${p.id}`);
    }
    for (const s of ['speed', 'afterburner', 'ramjet', 'cornering', 'resilience', 'battery', 'maneuvering'] as const) {
      if (!onDisk(statArtUrl(s)!)) missing.push(`stat ${s}`);
    }
    expect(missing).toEqual([]);
  });

  it('lists exactly the art a build needs', () => {
    const b: Build = newBuild('landspeeder');
    b.abilities = ['corrosive-vent', 'flame-vent', null, null];
    b.crashAbility = 'ion-blast';
    b.parts = [{ id: 'thermal-inverter', fault: null }];
    const urls = artUrlsFor(b, gameData);
    expect(urls.filter((u) => u.startsWith('/game/stats/'))).toHaveLength(7);
    expect(urls.filter((u) => u.startsWith('/game/abilities/'))).toHaveLength(2); // Corrosive and Flame Vent share a glyph
    expect(urls.filter((u) => u.startsWith('/game/part-thumbs/'))).toHaveLength(1);
  });
});

describe('share image with art', () => {
  const sample = (): Build => {
    const b = newBuild('landspeeder');
    b.abilities = ['corrosive-vent', null, null, null];
    b.parts = [{ id: 'thermal-inverter', fault: 'acidic-fuel' }];
    return b;
  };
  const images = () =>
    Object.fromEntries(
      artUrlsFor(sample(), gameData).map((u) => [u, `data:${u.endsWith('.png') ? 'image/png' : 'image/jpeg'};base64,${readFileSync(join(process.cwd(), 'public', u)).toString('base64')}`]),
    );

  it('draws the game art when it is supplied, and our icons when it is not', () => {
    const withArt = buildCardSvg(sample(), gameData, { images: images() });
    const without = buildCardSvg(sample(), gameData);
    expect(withArt.match(/<image /g)?.length).toBeGreaterThanOrEqual(9); // 7 stats + 1 ability + 1 part card
    expect(without).not.toContain('<image ');
    expect(without).toContain('stroke-linecap'); // the vector fallback
  });

  it('rasterises with the art to a real PNG', async () => {
    const png = await renderSvgPng(buildCardSvg(sample(), gameData, { images: images() }));
    expect(png.length).toBeGreaterThan(40000);
  });
});
