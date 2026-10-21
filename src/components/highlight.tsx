import { useMemo, type ReactNode } from 'react';
import type { GlossaryTerm, StatId } from '../data/types';

export const STAT_LABEL: Record<Exclude<StatId, 'maneuvering'>, string> = {
  afterburner: 'Afterburner',
  ramjet: 'Ramjet',
  cornering: 'Cornering',
  resilience: 'Resilience',
  battery: 'Battery',
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Regex matching game keywords (Burning, Ramjet, …) so they can be tinted gold like the in-game UI. */
export function useKeywordRe(glossary: GlossaryTerm[]): RegExp | null {
  return useMemo(() => {
    const names = glossary.map((g) => g.name).sort((a, b) => b.length - a.length);
    return names.length ? new RegExp(`\\b(${names.map(escapeRe).join('|')})\\b`, 'g') : null;
  }, [glossary]);
}

export function highlight(text: string, re: RegExp | null): ReactNode[] | string {
  if (!re) return text;
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push(
      <span key={m.index} className="kw">
        {m[0]}
      </span>,
    );
    last = m.index! + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}
