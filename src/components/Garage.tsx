import { useEffect, useState } from 'react';
import { decodeBuild, topSpeed, vehicleLevel } from '../lib/build';
import { gameData as data } from '../data';
import { deleteBuild, loadGarage, renameBuild, type SavedBuild } from '../lib/garage';
import { buildVerdict } from '../lib/verdict';

const nameOf = (list: { id: string; name: string }[], id: string | null) => list.find((x) => x.id === id)?.name;

/** Saved builds, kept in this browser (localStorage). Open, compare, share, rename or delete them. */
export default function Garage() {
  const [list, setList] = useState<SavedBuild[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => setList(loadGarage(localStorage)), []);
  if (list === null) return null;

  if (list.length === 0) {
    return (
      <section className="panel garage-empty">
        <h2 className="panel-title">
          <span>Nothing saved yet</span>
        </h2>
        <p>
          Press <b>Save build</b> in the planner and it shows up here. Builds are stored in this browser only, so they are
          private to you and are lost if you clear your site data. Copy a build's link to keep it somewhere safe.
        </p>
        <p className="gap-top">
          <a className="cta" href="/">
            Open the planner
          </a>
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2 className="panel-title">
        <span>Saved builds</span>
        <span className="aside">{list.length}</span>
      </h2>
      <div className="garage-list">
        {list.map((e) => {
          const build = decodeBuild(e.code);
          const cls = build && data.vehicleClasses.find((c) => c.id === build.classId);
          if (!build || !cls) return null;
          const verdict = buildVerdict(build, data);
          return (
            <article className="garage-item" key={e.id}>
              {editing === e.id ? (
                <form
                  className="garage-rename"
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    setList(renameBuild(localStorage, e.id, draft));
                    setEditing(null);
                  }}
                >
                  <input className="field" value={draft} autoFocus maxLength={40} aria-label="Build name" onChange={(ev) => setDraft(ev.target.value)} />
                  <button className="pill action" type="submit">
                    Save name
                  </button>
                </form>
              ) : (
                <h3>{e.name}</h3>
              )}
              <p className="sub">
                {cls.name} · {nameOf(data.racerStyles, build.styleId) ?? 'No style'} · Level {vehicleLevel(build.tuning)} ·{' '}
                {topSpeed(cls.baseSpeed, build.tuning, cls.id === 'podracer')} km/h
              </p>
              <p className="verdict-mini">
                <b>{verdict.title}.</b> {verdict.line}
              </p>
              <div className="garage-actions">
                <a href={`/?b=${e.code}`}>Open</a>
                <a href={`/compare/?a=${e.code}`}>Compare</a>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(`${location.origin}/b/${e.code}`);
                    setCopied(e.id);
                    setTimeout(() => setCopied(null), 1500);
                  }}
                >
                  {copied === e.id ? 'Link copied' : 'Copy link'}
                </button>
                <button
                  onClick={() => {
                    setEditing(e.id);
                    setDraft(e.name);
                  }}
                >
                  Rename
                </button>
                <button className="danger" onClick={() => setList(deleteBuild(localStorage, e.id))}>
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
