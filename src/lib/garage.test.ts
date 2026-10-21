import { describe, expect, it } from 'vitest';
import { emptyTuning, encodeBuild, newBuild, setTuning } from './build';
import { GARAGE_KEY, MAX_NAME, MAX_SAVED, deleteBuild, isSaved, loadGarage, renameBuild, saveBuild } from './garage';

const fakeStore = (initial?: string) => {
  const data = new Map<string, string>(initial === undefined ? [] : [[GARAGE_KEY, initial]]);
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};
const codeOf = (ramjet: number) => {
  const b = newBuild('landspeeder');
  b.tuning = setTuning(emptyTuning(), 'ramjet', ramjet);
  return encodeBuild(b);
};

describe('garage', () => {
  it('starts empty', () => {
    expect(loadGarage(fakeStore())).toEqual([]);
  });

  it('saves builds newest first and reads them back', () => {
    const s = fakeStore();
    saveBuild(s, 'First', codeOf(1), new Date('2026-01-01'), () => 'a');
    saveBuild(s, 'Second', codeOf(2), new Date('2026-01-02'), () => 'b');
    expect(loadGarage(s).map((e) => e.name)).toEqual(['Second', 'First']);
  });

  it('keeps one entry when the same build is saved again, using the new name', () => {
    const s = fakeStore();
    saveBuild(s, 'Old name', codeOf(3), new Date(), () => 'a');
    saveBuild(s, 'New name', codeOf(3), new Date(), () => 'zzz');
    const list = loadGarage(s);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'a', name: 'New name' });
  });

  it('renames and deletes', () => {
    const s = fakeStore();
    saveBuild(s, 'One', codeOf(1), new Date(), () => 'a');
    saveBuild(s, 'Two', codeOf(2), new Date(), () => 'b');
    expect(renameBuild(s, 'a', '  Renamed   build ').find((e) => e.id === 'a')?.name).toBe('Renamed build');
    expect(deleteBuild(s, 'b').map((e) => e.id)).toEqual(['a']);
  });

  it('trims long names and fills in empty ones', () => {
    const s = fakeStore();
    expect(saveBuild(s, 'x'.repeat(200), codeOf(1))[0].name).toHaveLength(MAX_NAME);
    expect(saveBuild(s, '   ', codeOf(2))[0].name).toBe('Untitled build');
  });

  it('refuses a code that is not a build', () => {
    expect(() => saveBuild(fakeStore(), 'bad', 'nope')).toThrow();
  });

  it('caps the number of saved builds', () => {
    const s = fakeStore();
    for (let i = 0; i < MAX_SAVED + 5; i++) {
      const b = newBuild('landspeeder');
      b.styleId = null;
      b.abilities = [`a-${i}`, null, null, null];
      saveBuild(s, `n${i}`, encodeBuild(b), new Date(), () => `id${i}`);
    }
    expect(loadGarage(s)).toHaveLength(MAX_SAVED);
  });

  it('survives corrupted storage and drops entries with bad codes', () => {
    expect(loadGarage(fakeStore('{not json'))).toEqual([]);
    expect(loadGarage(fakeStore('{"a":1}'))).toEqual([]);
    const good = { id: 'a', name: 'Good', code: codeOf(1), savedAt: '2026-01-01T00:00:00.000Z' };
    const mixed = [good, { id: 'b', name: 'Bad', code: 'garbage', savedAt: 'x' }, { nope: true }, null];
    expect(loadGarage(fakeStore(JSON.stringify(mixed)))).toEqual([good]);
  });

  it('knows whether a build is already saved', () => {
    const s = fakeStore();
    const b = newBuild('landspeeder');
    saveBuild(s, 'Mine', encodeBuild(b));
    expect(isSaved(loadGarage(s), b, encodeBuild)).toBe(true);
    b.styleRank = 2;
    expect(isSaved(loadGarage(s), b, encodeBuild)).toBe(false);
  });
});
