import { useEffect, useMemo, useState } from 'react';
import { CURRENT_BUILD_KEY, encodeBuild, type Build } from '../lib/build';
import { diffBuilds, parseBuildInput, type Numeric } from '../lib/compare';
import { gameData } from '../data';
import { loadGarage, type SavedBuild } from '../lib/garage';
import BuildPanels from './BuildPanels';
import { STAT_LABEL } from './highlight';

type Side = 'a' | 'b';

/** Compare two builds side by side: /compare?a=<code>&b=<code>. */
export default function Compare() {
  const data = gameData;
  const [codes, setCodes] = useState<Record<Side, string>>({ a: '', b: '' });
  const [drafts, setDrafts] = useState<Record<Side, string>>({ a: '', b: '' });
  const [ready, setReady] = useState(false);
  const [garage, setGarage] = useState<SavedBuild[]>([]);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const init = { a: q.get('a') ?? '', b: q.get('b') ?? '' };
    setCodes(init);
    setGarage(loadGarage(localStorage));
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const url = new URL(location.href);
    for (const side of ['a', 'b'] as const) {
      if (codes[side]) url.searchParams.set(side, codes[side]);
      else url.searchParams.delete(side);
    }
    history.replaceState(null, '', url);
  }, [codes, ready]);

  const builds = useMemo(
    () => ({ a: parseBuildInput(codes.a), b: parseBuildInput(codes.b) }) as Record<Side, Build | null>,
    [codes],
  );
  const name = (id: string, list: { id: string; name: string }[]) => list.find((x) => x.id === id)?.name ?? id;
  const partName = (id: string | null) => (id ? name(id, data.parts) : 'none');

  const load = (side: Side, input: string) => {
    const build = parseBuildInput(input);
    if (!build) return setDrafts((d) => ({ ...d, [side]: input }));
    setCodes((c) => ({ ...c, [side]: encodeBuild(build) }));
    setDrafts((d) => ({ ...d, [side]: '' }));
  };
  const useMine = (side: Side) => {
    const mine = localStorage.getItem(CURRENT_BUILD_KEY);
    if (mine) load(side, mine);
  };
  const hasMine = ready && !!localStorage.getItem(CURRENT_BUILD_KEY);

  if (!ready) return null;
  const diff = builds.a && builds.b ? diffBuilds(builds.a, builds.b, data) : null;

  return (
    <div className="planner">
      <header className="planner-head">
        <h1>
          <span className="slash">/</span>COMPARE
        </h1>
        <div className="head-tools">
          <button
            className="pill action"
            disabled={!codes.a && !codes.b}
            onClick={() => setCodes((c) => ({ a: c.b, b: c.a }))}
          >
            Swap
          </button>
          <a className="pill action" href="/">
            Planner
          </a>
        </div>
      </header>

      <div className="compare-pickers">
        {(['a', 'b'] as const).map((side) => (
          <section className="panel" key={side}>
            <h2>Build {side.toUpperCase()}</h2>
            <input
              className="field"
              placeholder="Paste a build link or code"
              value={drafts[side]}
              aria-label={`Build ${side.toUpperCase()} link`}
              onChange={(e) => load(side, e.target.value)}
            />
            {builds[side] && !drafts[side] && (
              <p className="hint">
                {name(builds[side]!.classId, data.vehicleClasses)}
                {builds[side]!.styleId ? ` · ${name(builds[side]!.styleId!, data.racerStyles)}` : ''}
              </p>
            )}
            {drafts[side] && !parseBuildInput(drafts[side]) && <p className="hint">That isn't a valid build link.</p>}
            {garage.length > 0 && (
              <select
                className="field garage-pick"
                aria-label={`Pick build ${side.toUpperCase()} from your garage`}
                value=""
                onChange={(e) => {
                  const hit = garage.find((g) => g.id === e.target.value);
                  if (hit) load(side, hit.code);
                }}
              >
                <option value="">Pick from your garage…</option>
                {garage.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}
            <div className="row">
              {hasMine && (
                <button className="link" onClick={() => useMine(side)}>
                  Use my current build
                </button>
              )}
              {codes[side] && (
                <button className="link" onClick={() => setCodes((c) => ({ ...c, [side]: '' }))}>
                  Clear
                </button>
              )}
            </div>
          </section>
        ))}
      </div>

      {diff && builds.a && builds.b && (
        <section className="panel diff" aria-label="Differences">
          <h2>Differences</h2>
          {diff.identical && <p className="hint">These builds are identical.</p>}
          {!diff.sameClass && (
            <p className="hint">These builds use different vehicle classes, so speed and maneuvering are not like for like.</p>
          )}
          <table>
            <thead>
              <tr>
                <th />
                <th>A</th>
                <th>B</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <NumRow label="Speed" n={diff.speed} judge />
              <NumRow label="Level" n={diff.level} />
              <NumRow label="Tuning Points" n={diff.points} />
              {diff.stats.map((s) => (
                <NumRow
                  key={s.stat}
                  label={s.stat === 'maneuvering' ? 'Maneuvering' : STAT_LABEL[s.stat]}
                  n={{ a: s.a, b: s.b }}
                  hideSame
                />
              ))}
            </tbody>
          </table>
          <OnlyList title="Traits" only={diff.traits} />
          <OnlyList
            title="Abilities"
            only={{
              onlyA: diff.abilities.onlyA.map((id) => name(id, data.abilities)),
              onlyB: diff.abilities.onlyB.map((id) => name(id, data.abilities)),
            }}
          />
          <OnlyList
            title="Parts"
            only={{
              onlyA: diff.parts.onlyA.map((id) => name(id, data.parts)),
              onlyB: diff.parts.onlyB.map((id) => name(id, data.parts)),
            }}
          />
          {diff.faults.length > 0 && (
            <div className="only">
              <h3>Faults on shared parts</h3>
              <ul>
                {diff.faults.map((f) => (
                  <li key={f.part}>
                    {name(f.part, data.parts)}: A has {partName(f.a)}, B has {partName(f.b)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <div className="compare-builds">
        {(['a', 'b'] as const).map((side) => (
          <div key={side}>
            {builds[side] ? (
              <BuildPanels build={builds[side]!} data={data} compact />
            ) : (
              <section className="panel">
                <p className="hint">Add build {side.toUpperCase()} above.</p>
              </section>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** `judge` colours the delta green/red; only meaningful for numbers where higher is plainly better (speed). */
function NumRow({ label, n, hideSame, judge }: { label: string; n: Numeric; hideSame?: boolean; judge?: boolean }) {
  const delta = n.b - n.a;
  if (hideSame && delta === 0) return null;
  const tone = !judge || delta === 0 ? '' : delta > 0 ? 'up' : 'down';
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{n.a}</td>
      <td>{n.b}</td>
      <td className={tone}>{delta === 0 ? '=' : `${delta > 0 ? '+' : ''}${delta}`}</td>
    </tr>
  );
}

function OnlyList({ title, only }: { title: string; only: { onlyA: string[]; onlyB: string[] } }) {
  if (only.onlyA.length + only.onlyB.length === 0) return null;
  return (
    <div className="only">
      <h3>{title}</h3>
      <div className="only-cols">
        <ul>
          {only.onlyA.map((x) => (
            <li key={x}>A only: {x}</li>
          ))}
        </ul>
        <ul>
          {only.onlyB.map((x) => (
            <li key={x}>B only: {x}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
