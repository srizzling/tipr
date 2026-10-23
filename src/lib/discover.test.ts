import { describe, expect, it } from 'vitest';
import { gameData } from '../data';
import { ABILITY_SLOTS, MAX_BOXES_PER_STAT, MAX_PARTS, MAX_STAT_BOXES, MAX_TUNING_BOXES, decodeBuild, totalBoxes } from './build';
import { STAT_IDS } from '../data/types';
import { discoverCode, discoverEntries, redditEmbedUrl } from './discover';

const ids = (list: { id: string }[]) => new Set(list.map((x) => x.id));
const classes = ids(gameData.vehicleClasses);
const styles = ids(gameData.racerStyles);
const abilities = ids(gameData.abilities);
const parts = ids(gameData.parts.filter((p) => !p.fault));
const faults = ids(gameData.parts.filter((p) => p.fault));

describe('discover entries', () => {
  it('has at least one entry and unique ids', () => {
    expect(discoverEntries.length).toBeGreaterThan(0);
    expect(new Set(discoverEntries.map((e) => e.id)).size).toBe(discoverEntries.length);
  });

  for (const e of discoverEntries) {
    describe(e.id, () => {
      it('credits a Reddit user and links to a Reddit post', () => {
        expect(e.author).toMatch(/^[A-Za-z0-9_-]{3,20}$/);
        expect(e.post).toMatch(/^https:\/\/www\.reddit\.com\/r\/StarWarsGalacticRacer\/comments\/[a-z0-9]+\/[a-z0-9_]*\/?$/);
        expect(e.posted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(['video', 'image']).toContain(e.media);
        expect(redditEmbedUrl(e.post), 'embed url').not.toBeNull();
        expect(e.title.trim()).not.toBe('');
        expect(e.note.trim()).not.toBe('');
      });

      it('only uses ids that exist in the game data', () => {
        const b = e.build;
        expect(classes.has(b.classId), b.classId).toBe(true);
        expect(b.styleId === null || styles.has(b.styleId), String(b.styleId)).toBe(true);
        expect(b.abilities).toHaveLength(ABILITY_SLOTS);
        for (const a of [...b.abilities, b.crashAbility]) expect(a === null || abilities.has(a), String(a)).toBe(true);
        expect(b.parts.length).toBeLessThanOrEqual(MAX_PARTS);
        for (const p of b.parts) {
          expect(parts.has(p.id), p.id).toBe(true);
          expect(p.fault === null || faults.has(p.fault), String(p.fault)).toBe(true);
        }
      });

      it('has box counts the game allows', () => {
        expect(totalBoxes(e.build.tuning)).toBeLessThanOrEqual(MAX_TUNING_BOXES);
        for (const stat of STAT_IDS) {
          expect(e.build.tuning[stat], `${stat} tuning`).toBeLessThanOrEqual(MAX_BOXES_PER_STAT);
          expect(e.build.tuning[stat] + e.build.bonus[stat], `${stat} total`).toBeLessThanOrEqual(MAX_STAT_BOXES);
        }
      });

      it('survives the share-link round trip', () => {
        const decoded = decodeBuild(discoverCode(e));
        expect(decoded).toMatchObject(e.build);
      });
    });
  }
});

describe('redditEmbedUrl', () => {
  it('points an ordinary post at Reddit\'s embed domain', () => {
    expect(redditEmbedUrl('https://www.reddit.com/r/StarWarsGalacticRacer/comments/1x0qdf1/best_build_by_far/')).toBe(
      'https://embed.reddit.com/r/StarWarsGalacticRacer/comments/1x0qdf1/best_build_by_far/?embed=true&theme=dark&showmedia=true&showmore=false&showedits=false',
    );
  });

  it('refuses anything else, so no other site can be framed', () => {
    for (const bad of [
      'https://example.com/r/x/comments/abc/slug/',
      'https://www.reddit.com.evil.example/r/x/comments/abc/slug/',
      'http://www.reddit.com/r/x/comments/abc/slug/',
      'https://www.reddit.com/user/someone/',
      'https://www.reddit.com/r/x/comments/abc/slug/?utm_source=x',
      'https://www.reddit.com/r/x/comments/abc/slug/#frag',
      'javascript:alert(1)',
      'not a url',
    ]) {
      expect(redditEmbedUrl(bad), bad).toBeNull();
    }
  });
});
