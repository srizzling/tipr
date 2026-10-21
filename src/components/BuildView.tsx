import { useEffect, useMemo, useState } from 'react';
import { decodeBuild, topSpeed, totalBoxes, tuningCost, vehicleLevel, MAX_BOXES_PER_STAT, type Build } from '../lib/build';
import { STAT_IDS, type GameData } from '../data/types';
import { STAT_LABEL, highlight, useKeywordRe } from './highlight';

/** Read-only page for a shared build: /b/<code>. */
export default function BuildView({ data }: { data: GameData }) {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => setCode(location.pathname.replace(/^\/b\//, '').replace(/\/$/, '')), []);

  const build: Build | null = useMemo(() => (code ? decodeBuild(code) : null), [code]);
  const keywordRe = useKeywordRe(data.glossary);

  if (code === null) return null;
  const cls = build && data.vehicleClasses.find((c) => c.id === build.classId);
  if (!build || !cls) {
    return (
      <div className="planner">
        <section className="panel">
          <h2>Build not found</h2>
          <p>This link isn't a valid build. It may have been cut off when it was copied.</p>
          <p style={{ marginTop: 12 }}>
            <a className="pill action" href="/">
              Start a new build
            </a>
          </p>
        </section>
      </div>
    );
  }

  const style = data.racerStyles.find((s) => s.id === build.styleId);
  const traits = style ? style.ranks.filter((r) => r.rank <= build.styleRank).flatMap((r) => r.traits) : [];
  const ability = (id: string | null) => data.abilities.find((a) => a.id === id);
  const find = (id: string | null) => data.parts.find((p) => p.id === id);
  const parts = build.parts.flatMap(({ id, fault }) => {
    const part = find(id);
    return part ? [{ part, fault: find(fault) }] : [];
  });

  return (
    <div className="planner">
      <header className="planner-head">
        <h1>
          <span className="slash">/</span>BUILD
        </h1>
        <div className="head-tools">
          <div className="pill">
            {cls.name} <b>Lv {vehicleLevel(build.tuning)}</b>
          </div>
          <div className="pill">
            Tuning Points <b>{tuningCost(totalBoxes(build.tuning))}</b>
          </div>
          <a className="pill action" href={`/?b=${code}`}>
            Edit this build
          </a>
          <button
            className="pill action"
            onClick={async () => {
              await navigator.clipboard.writeText(location.href);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? 'Link copied' : 'Copy link'}
          </button>
        </div>
      </header>

      <main className="cols">
        <section className="panel">
          <h2>Vehicle stats</h2>
          <div className="field static">{cls.name}</div>
          <div className="speed">
            <span>Speed</span>
            <b>{topSpeed(cls.baseSpeed, build.tuning, cls.id === 'podracer')}</b>
          </div>
          {STAT_IDS.map((stat) => (
            <div className="stat" key={stat}>
              <span className="stat-name">{stat === 'maneuvering' ? cls.maneuveringName : STAT_LABEL[stat]}</span>
              <div className="boxes">
                {Array.from({ length: MAX_BOXES_PER_STAT }, (_, i) => (
                  <span key={i} className={i < build.tuning[stat] ? 'box on' : 'box'} />
                ))}
                {[0, 1, 2].map((i) => (
                  <span key={i} className="box big" />
                ))}
              </div>
            </div>
          ))}
        </section>

        <div className="stack">
          <section className="panel">
            <h2>Racer style</h2>
            <div className="field static">
              {style ? `${style.name} · Rank ${build.styleRank}` : 'No style'}
            </div>
            <ul className="traits" style={{ marginTop: 10 }}>
              {traits.map((t) => (
                <li key={t.name}>
                  <h3>{t.name}</h3>
                  <p>{highlight(t.text, keywordRe)}</p>
                </li>
              ))}
            </ul>
          </section>
          <section className="panel">
            <h2>Abilities</h2>
            <div className="abilities">
              {build.abilities.map((id, i) => (
                <div key={i} className={`ability ${ability(id) ? 'filled' : ''}`}>
                  <span className="orb" />
                  <span>
                    <b>{ability(id)?.name ?? ''}</b>
                    <small>Ability {i + 1}</small>
                  </span>
                </div>
              ))}
              <div className={`ability wide ${ability(build.crashAbility) ? 'filled' : ''}`}>
                <span className="orb" />
                <span>
                  <b>{ability(build.crashAbility)?.name ?? ''}</b>
                  <small>Crash Ability</small>
                </span>
              </div>
            </div>
          </section>
        </div>

        <section className="panel">
          <h2>Installed</h2>
          <ul className="parts">
            {parts.map(({ part, fault }) => (
              <li key={part.id} className={`part ${part.rarity}`}>
                <h3>{part.name}</h3>
                <p>{highlight(part.text, keywordRe)}</p>
                {fault && <p className="downside">{highlight(fault.text, keywordRe)}</p>}
              </li>
            ))}
            {parts.length === 0 && <li className="hint">No parts installed.</li>}
          </ul>
        </section>
      </main>
    </div>
  );
}
