import { decodeBuild, type Build } from './build';

/** Builds saved in this browser only (nothing is uploaded). */
export interface SavedBuild {
  id: string;
  name: string;
  /** The share code, the same one used in links, so a saved build opens anywhere. */
  code: string;
  savedAt: string;
}

export const GARAGE_KEY = 'tipr:garage';
export const MAX_SAVED = 50;
export const MAX_NAME = 40;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

const cleanName = (name: string) => name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) || 'Untitled build';

/** Reads the garage, dropping anything that is not a valid saved build (storage can be edited or corrupted). */
export function loadGarage(store: Store): SavedBuild[] {
  try {
    const raw = JSON.parse(store.getItem(GARAGE_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (e): e is SavedBuild =>
          !!e && typeof e.id === 'string' && typeof e.name === 'string' && typeof e.code === 'string' && typeof e.savedAt === 'string' && decodeBuild(e.code) !== null,
      )
      .map((e) => ({ id: e.id, name: cleanName(e.name), code: e.code, savedAt: e.savedAt }))
      .slice(0, MAX_SAVED);
  } catch {
    return [];
  }
}

function write(store: Store, list: SavedBuild[]): SavedBuild[] {
  store.setItem(GARAGE_KEY, JSON.stringify(list));
  return list;
}

/** Saves a build. The same build saved again keeps one entry and just takes the new name. Newest first. */
export function saveBuild(store: Store, name: string, code: string, now = new Date(), newId = () => Math.random().toString(36).slice(2, 10)): SavedBuild[] {
  if (!decodeBuild(code)) throw new Error('Not a valid build');
  const list = loadGarage(store);
  const existing = list.find((e) => e.code === code);
  const entry: SavedBuild = { id: existing?.id ?? newId(), name: cleanName(name), code, savedAt: now.toISOString() };
  return write(store, [entry, ...list.filter((e) => e.id !== entry.id)].slice(0, MAX_SAVED));
}

export function renameBuild(store: Store, id: string, name: string): SavedBuild[] {
  return write(store, loadGarage(store).map((e) => (e.id === id ? { ...e, name: cleanName(name) } : e)));
}

export function deleteBuild(store: Store, id: string): SavedBuild[] {
  return write(store, loadGarage(store).filter((e) => e.id !== id));
}

export const isSaved = (list: SavedBuild[], build: Build, encode: (b: Build) => string) => list.some((e) => e.code === encode(build));
