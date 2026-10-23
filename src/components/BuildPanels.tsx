import { MAX_PARTS, type Build } from '../lib/build';
import type { GameData } from '../data/types';
import { highlight, useKeywordRe } from './highlight';
import { AbilityGlyph, PanelHeading, PartRow, StatRows } from './ui';

/** The three read-only panels (stats, style and abilities, installed parts) for one build. */
export default function BuildPanels({ build, data, compact }: { build: Build; data: GameData; compact?: boolean }) {
  const keywordRe = useKeywordRe(data.glossary);
  const cls = data.vehicleClasses.find((c) => c.id === build.classId);
  if (!cls) return null;
  const style = data.racerStyles.find((s) => s.id === build.styleId);
  const traits = style ? style.ranks.filter((r) => r.rank <= build.styleRank).flatMap((r) => r.traits) : [];
  const ability = (id: string | null) => data.abilities.find((a) => a.id === id);
  const find = (id: string | null) => data.parts.find((p) => p.id === id);
  const parts = build.parts.flatMap(({ id, fault }) => {
    const part = find(id);
    return part ? [{ part, fault: find(fault) }] : [];
  });

  return (
    <main className={compact ? 'cols compact' : 'cols'}>
      <section className="panel">
        <PanelHeading title="Vehicle stats" sub={cls.name} />
        <StatRows cls={cls} tuning={build.tuning} bonus={build.bonus} />
      </section>

      <div className="stack">
        <section className="panel">
          <PanelHeading title="Racer style" sub={style ? `${style.name} · Rank ${build.styleRank}` : 'No style'} />
          <ul className="traits">
            {traits.map((t) => (
              <li key={t.name}>
                <h3>{t.name}</h3>
                <p>{highlight(t.text, keywordRe)}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <PanelHeading title="Abilities" />
          <div className="abilities">
            {build.abilities.map((id, i) => (
              <div key={i} className={`ability ${ability(id) ? 'filled' : ''}`}>
                <span className="orb">{ability(id) && <AbilityGlyph ability={ability(id)!} />}</span>
                <span>
                  <b>{ability(id)?.name ?? ''}</b>
                  <small>Ability {i + 1}</small>
                </span>
              </div>
            ))}
            <div className={`ability wide ${ability(build.crashAbility) ? 'filled' : ''}`}>
              <span className="orb">{ability(build.crashAbility) && <AbilityGlyph ability={ability(build.crashAbility)!} />}</span>
              <span>
                <b>{ability(build.crashAbility)?.name ?? ''}</b>
                <small>Crash Ability</small>
              </span>
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <PanelHeading title="Installed parts" aside={`${parts.length}/${MAX_PARTS}`} />
        <ul className="parts">
          {parts.map(({ part, fault }) => (
            <PartRow key={part.id} part={part} fault={fault} keywordRe={keywordRe} />
          ))}
          {parts.length === 0 && <li className="hint">No parts installed.</li>}
        </ul>
      </section>
    </main>
  );
}
