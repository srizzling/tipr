import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CURRENT_BUILD_KEY,
  MAX_PARTS,
  MAX_TUNING_BOXES,
  decodeBuild,
  emptyTuning,
  encodeBuild,
  fitToBudget,
  newBuild,
  placeAbility,
  setAbilitySlot,
  setTuning,
  totalBoxes,
  tuningCost,
  vehicleLevel,
  type Build,
} from '../lib/build';
import type { Ability, Part } from '../data/types';
import { gameData } from '../data';
import { highlight, useKeywordRe } from './highlight';
import { AbilityGlyph, Key, PanelHeading, PartArt, PartRow, StatRows, TipLogo, VerdictStrip } from './ui';
import { partArtUrl } from '../lib/game-art';
import { buildVerdict } from '../lib/verdict';
import { FAULT_GROUPS, faultGroup } from '../lib/faults';
import AbilityBoard from './AbilityBoard';

type Mode = 'all' | 'mine';
type PickerState =
  | { kind: 'ability'; slot: number | 'crash' }
  | { kind: 'part' }
  | { kind: 'fault'; partId: string }
  | null;

export default function Planner() {
  const data = gameData;
  const [build, setBuild] = useState<Build>(() => newBuild(data.vehicleClasses[1]?.id ?? data.vehicleClasses[0].id));
  const [mode, setMode] = useState<Mode>('all');
  const [events, setEvents] = useState(120);
  const [earned, setEarned] = useState(163);
  const [picker, setPicker] = useState<PickerState>(null);
  const [copied, setCopied] = useState(false);
  const [verdictSeed, setVerdictSeed] = useState(0);
  const [imageState, setImageState] = useState<'idle' | 'working' | 'copied' | 'failed'>('idle');

  // hydrate from share link, then keep the URL in sync
  useEffect(() => {
    const raw = new URLSearchParams(location.search).get('b');
    const decoded = decodeBuild(raw ?? localStorage.getItem(CURRENT_BUILD_KEY) ?? '');
    if (decoded) setBuild(decoded);
  }, []);
  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set('b', encodeBuild(build));
    history.replaceState(null, '', url);
    localStorage.setItem(CURRENT_BUILD_KEY, encodeBuild(build));
  }, [build]);

  const budget = mode === 'all' ? Infinity : earned;
  const cls = data.vehicleClasses.find((c) => c.id === build.classId) ?? data.vehicleClasses[0];
  const style = data.racerStyles.find((s) => s.id === build.styleId);
  const partById = useMemo(() => new Map(data.parts.map((p) => [p.id, p])), [data.parts]);

  const keywordRe = useKeywordRe(data.glossary);

  const verdict = useMemo(() => buildVerdict(build, data, verdictSeed), [build, data, verdictSeed]);
  const spent = tuningCost(totalBoxes(build.tuning));
  const campaignStyles = data.racerStyles.filter((s) => !s.multiplayerOnly);
  const traits = style ? style.ranks.filter((r) => r.rank <= build.styleRank).flatMap((r) => r.traits) : [];

  const update = (patch: Partial<Build>) => setBuild((b) => ({ ...b, ...patch }));
  const share = async () => {
    await navigator.clipboard.writeText(`${location.origin}/b/${encodeBuild(build)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  /** Draws the build screen to a PNG in the browser: copy it to the clipboard, or save it if copying is not allowed. */
  const shareImage = async (mode: 'copy' | 'save') => {
    setImageState('working');
    try {
      const { copyBuildImage, saveBuildImage } = await import('../lib/share-image');
      if (mode === 'copy') await copyBuildImage(build, verdict);
      else await saveBuildImage(build, verdict);
      setImageState('copied');
    } catch {
      setImageState('failed');
    }
    setTimeout(() => setImageState('idle'), 2000);
  };
  const cycleClass = (dir: 1 | -1) => {
    const i = data.vehicleClasses.findIndex((c) => c.id === build.classId);
    const next = data.vehicleClasses[(i + dir + data.vehicleClasses.length) % data.vehicleClasses.length];
    update({ classId: next.id });
  };
  const goCompare = () => {
    location.href = `/compare?a=${encodeBuild(build)}`;
  };

  // S / C / R shortcuts, like the key hints on the game's screen. Never while typing or with a dialog open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || picker || t?.closest('input, textarea, select, [contenteditable]')) return;
      const k = e.key.toLowerCase();
      if (k === 's') void share();
      else if (k === 'c') goCompare();
      else if (k === 'i') void shareImage('copy');
      else if (k === 'd') void shareImage('save');
      else if (k === 'r') update({ tuning: emptyTuning() });
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const partAvailable = (p: Part) => mode === 'all' || p.unlockEvents === null || p.unlockEvents <= events;

  return (
    <div className="planner">
      <header className="planner-head">
        <h1>
          <span className="slash">/</span>BUILD
          <TipLogo />
        </h1>
        <div className="head-tools">
          <div className="seg" role="group" aria-label="Unlock mode">
            <button className={mode === 'all' ? 'on' : ''} onClick={() => setMode('all')}>
              All unlocked
            </button>
            <button className={mode === 'mine' ? 'on' : ''} onClick={() => setMode('mine')}>
              My unlocks
            </button>
          </div>
          <div className="pill">
            Tuning Points{' '}
            <b>
              {spent}
              {mode === 'mine' ? ` / ${earned}` : ''}
            </b>
          </div>
          <a className="pill action" href={`/compare?a=${encodeBuild(build)}`}>
            Compare
          </a>
          <button className="pill action" onClick={share}>
            {copied ? 'Link copied' : 'Share build'}
          </button>
        </div>
      </header>

      {mode === 'mine' && (
        <div className="mine-bar">
          <label>
            Events completed <b>{events}</b>
            <input type="range" min={0} max={120} value={events} onChange={(e) => setEvents(+e.target.value)} />
          </label>
          <label>
            Tuning Points earned <b>{earned}</b>
            <input type="range" min={0} max={163} value={earned} onChange={(e) => {
                const v = +e.target.value;
                setEarned(v);
                setBuild((b) => ({ ...b, tuning: fitToBudget(b.tuning, v) }));
              }} />
          </label>
          <p className="hint">Save-file import will fill these in automatically.</p>
        </div>
      )}

      <VerdictStrip verdict={verdict} onReroll={() => setVerdictSeed((n) => n + 1)} />

      <main className="cols">
        {/* ---- Vehicle stats ---- */}
        <section className="panel">
          <PanelHeading title="Vehicle stats" />
          <div className="class-row">
            <button className="nav" aria-label="Previous vehicle" onClick={() => cycleClass(-1)}>
              ‹
            </button>
            <select
              className="field"
              value={build.classId}
              onChange={(e) => update({ classId: e.target.value })}
              aria-label="Vehicle class"
            >
              {data.vehicleClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button className="nav" aria-label="Next vehicle" onClick={() => cycleClass(1)}>
              ›
            </button>
          </div>
          <StatRows
            cls={cls}
            tuning={build.tuning}
            onSet={(stat, boxes) => update({ tuning: setTuning(build.tuning, stat, boxes, budget) })}
          />
          <p className="hint">
            Level {vehicleLevel(build.tuning)} / {MAX_TUNING_BOXES + 1} · {spent} point{spent === 1 ? '' : 's'} spent
          </p>
        </section>

        {/* ---- Racer style + abilities ---- */}
        <div className="stack">
          <section className="panel">
            <PanelHeading title="Racer style" />
            <select
              className="field"
              value={build.styleId ?? ''}
              onChange={(e) => update({ styleId: e.target.value || null, styleRank: 3 })}
              aria-label="Racer style"
            >
              <option value="">None</option>
              {campaignStyles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {style && (
              <>
                <div className="seg small" role="group" aria-label="Style rank">
                  {[1, 2, 3].map((r) => (
                    <button
                      key={r}
                      className={build.styleRank === r ? 'on' : ''}
                      onClick={() => update({ styleRank: r as 1 | 2 | 3 })}
                    >
                      Rank {r}
                    </button>
                  ))}
                </div>
                {mode === 'mine' && (
                  <p className="hint">
                    Rank {build.styleRank}: {style.ranks.find((r) => r.rank === build.styleRank)?.unlock}
                  </p>
                )}
                <ul className="traits">
                  {traits.map((t) => (
                    <li key={t.name}>
                      <h3>{t.name}</h3>
                      <p>{highlight(t.text, keywordRe)}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="panel">
            <PanelHeading title="Abilities" />
            <AbilityBoard
              build={build}
              abilities={data.abilities}
              onChange={setBuild}
              onOpenPicker={(slot) => setPicker({ kind: 'ability', slot })}
            />
          </section>
        </div>

        {/* ---- Installed parts ---- */}
        <section className="panel">
          <PanelHeading title="Installed parts" aside={`${build.parts.length}/${MAX_PARTS}`} />
          <ul className="parts">
            {build.parts.map(({ id, fault }) => {
              const p = partById.get(id);
              if (!p) return null;
              return (
                <PartRow
                  key={id}
                  part={p}
                  fault={fault ? partById.get(fault) : undefined}
                  keywordRe={keywordRe}
                  onRemove={() => update({ parts: build.parts.filter((x) => x.id !== id) })}
                  onFault={() => setPicker({ kind: 'fault', partId: id })}
                  onClearFault={() =>
                    update({ parts: build.parts.map((x) => (x.id === id ? { ...x, fault: null } : x)) })
                  }
                />
              );
            })}
            {build.parts.length < MAX_PARTS && (
              <li>
                <button className="add" onClick={() => setPicker({ kind: 'part' })}>
                  + Add part
                </button>
              </li>
            )}
          </ul>
        </section>
      </main>

      <div className="keys">
        <Key k="S" onClick={share}>
          {copied ? 'Link copied' : 'Share link'}
        </Key>
        <Key k="I" onClick={() => shareImage('copy')}>
          {imageState === 'working' ? 'Drawing…' : imageState === 'copied' ? 'Image ready' : imageState === 'failed' ? 'Could not make image' : 'Copy image'}
        </Key>
        <Key k="D" onClick={() => shareImage('save')}>
          Save image
        </Key>
        <Key k="C" onClick={goCompare}>
          Compare
        </Key>
        <Key k="R" onClick={() => update({ tuning: emptyTuning() })}>
          Respec
        </Key>
      </div>

      <div className="ad-slot" aria-hidden>
        Ad slot
      </div>

      {picker?.kind === 'ability' && (
        <Picker<Ability>
          title={picker.slot === 'crash' ? 'Crash ability' : `Ability ${(picker.slot as number) + 1}`}
          items={data.abilities.filter((a) => a.crash === (picker.slot === 'crash'))}
          selectedIds={[...build.abilities, build.crashAbility].filter(Boolean) as string[]}
          render={(a) => ({
            name: a.name,
            meta: `Tier ${a.tier} · ${a.cost} cr`,
            text: a.text,
            art: (
              <span className="pick-glyph">
                <AbilityGlyph ability={a} size={26} />
              </span>
            ),
          })}
          onClose={() => setPicker(null)}
          onPick={(a) => {
            setBuild((b) =>
              a
                ? placeAbility(b, picker.slot, a.id, (id) => data.abilities.find((x) => x.id === id)?.crash ?? false)
                : setAbilitySlot(b, picker.slot, null),
            );
            setPicker(null);
          }}
          clearable
          keywordRe={keywordRe}
        />
      )}
      {picker?.kind === 'part' && (
        <Picker<Part>
          title="Add part"
          items={data.parts.filter((p) => !p.fault && !build.parts.some((x) => x.id === p.id))}
          disabled={(p) => !partAvailable(p)}
          render={(p) => ({
            name: p.name,
            meta: `${p.rarity}${p.price ? ` · ${p.price} cr` : ''}${p.unlockEvents ? ` · ${p.unlockEvents} events` : ''}`,
            text: p.downside ? `${p.text} — ${p.downside}` : p.text,
            art: partArtUrl(p) ? <span className="pick-art-wrap"><PartArt part={p} /></span> : undefined,
          })}
          onClose={() => setPicker(null)}
          onPick={(p) => {
            if (p) update({ parts: [...build.parts, { id: p.id, fault: null }] });
            setPicker(null);
          }}
          keywordRe={keywordRe}
        />
      )}
      {picker?.kind === 'fault' && (
        <Picker<Part>
          title="Add a fault"
          intro="Faults appear when a part malfunctions during a run. You only need one here to describe a specific run."
          items={data.parts.filter((p) => p.fault)}
          group={faultGroup}
          groupOrder={FAULT_GROUPS}
          render={(p) => ({ name: p.name, meta: '', text: p.text })}
          onClose={() => setPicker(null)}
          onPick={(f) => {
            if (f)
              update({
                parts: build.parts.map((x) => (x.id === picker.partId ? { ...x, fault: f.id } : x)),
              });
            setPicker(null);
          }}
          keywordRe={keywordRe}
        />
      )}
    </div>
  );
}

interface PickerProps<T extends { id: string }> {
  title: string;
  items: T[];
  selectedIds?: string[];
  disabled?: (item: T) => boolean;
  render: (item: T) => { name: string; meta: string; text: string; art?: ReactNode };
  onPick: (item: T | null) => void;
  onClose: () => void;
  clearable?: boolean;
  keywordRe: RegExp | null;
  /** Short explanation shown above the list. */
  intro?: string;
  /** Group items under headings, with a chip per group to filter by. */
  group?: (item: T) => string;
  groupOrder?: readonly string[];
}

function Picker<T extends { id: string }>({
  title,
  items,
  selectedIds = [],
  disabled,
  render,
  onPick,
  onClose,
  clearable,
  keywordRe,
  intro,
  group,
  groupOrder = [],
}: PickerProps<T>) {
  const [q, setQ] = useState('');
  const [only, setOnly] = useState<string | null>(null);
  const query = useDeferredValue(q).toLowerCase();
  const rank = (g: string) => (groupOrder.includes(g) ? groupOrder.indexOf(g) : groupOrder.length);

  // Rendering and keyword-highlighting 250+ rows is the expensive part, so do it once per open, not per keystroke.
  const rows = useMemo(
    () =>
      items.map((i) => {
        const r = render(i);
        return { i, r, g: group?.(i) ?? '', haystack: `${r.name} ${r.text}`.toLowerCase(), text: highlight(r.text, keywordRe) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, keywordRe],
  );
  const matches = useMemo(() => rows.filter((row) => row.haystack.includes(query)), [rows, query]);
  const counts = new Map<string, number>();
  for (const m of matches) counts.set(m.g, (counts.get(m.g) ?? 0) + 1);
  const shown = matches
    .filter((m) => !only || m.g === only)
    .sort((a, b) => (group ? rank(a.g) - rank(b.g) : 0));
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="x" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <input
          className="field"
          autoFocus
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {intro && <p className="hint">{intro}</p>}
        {group && (
          <div className="chips" role="group" aria-label="Filter by type">
            <button className={only === null ? 'on' : ''} onClick={() => setOnly(null)}>
              All {matches.length}
            </button>
            {[...counts.entries()]
              .sort(([a], [b]) => rank(a) - rank(b))
              .map(([g, n]) => (
                <button key={g} className={only === g ? 'on' : ''} onClick={() => setOnly(only === g ? null : g)}>
                  {g} {n}
                </button>
              ))}
          </div>
        )}
        {clearable && (
          <button className="link" onClick={() => onPick(null)}>
            Clear slot
          </button>
        )}
        <ul className="pick-list">
          {shown.map(({ i, r, g, text }, idx) => (
            <li key={i.id}>
              {group && (idx === 0 || shown[idx - 1].g !== g) && <h3 className="group-head">{g}</h3>}
              <button disabled={disabled?.(i)} onClick={() => onPick(i)} className={selectedIds.includes(i.id) ? 'used' : ''}>
                {r.art}
                <b>{r.name}</b> <small>{r.meta}</small>
                <p>{text}</p>
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="hint">Nothing matches.</li>}
        </ul>
      </div>
    </div>
  );
}
