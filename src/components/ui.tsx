import type { ReactNode } from 'react';
import { MAX_BOXES_PER_STAT, MAX_ENERGY_SCALE, maxEnergy, topSpeed, type InstalledPart } from '../lib/build';
import { STAT_IDS, type Part, type StatId, type VehicleClass } from '../data/types';
import { STAT_LABEL, highlight } from './highlight';

/* Original line icons (not the game's art). 24x24 viewBox, drawn with strokes so they inherit currentColor. */
const ICONS = {
  speed: (
    <>
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="M12 17l4-5" />
    </>
  ),
  afterburner: (
    <>
      <path d="M6 9l6-5 6 5" />
      <path d="M6 14l6-5 6 5" />
      <path d="M6 19l6-5 6 5" />
    </>
  ),
  ramjet: <path d="M12 3c3 4 5 6 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z" />,
  cornering: (
    <>
      <path d="M5 20c0-8 3-12 12-12" />
      <path d="M13 4l4 4-4 4" />
    </>
  ),
  resilience: <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />,
  battery: (
    <>
      <rect x="3" y="8" width="15" height="8" rx="1.5" />
      <path d="M20.5 10.5v3" />
      <path d="M7 11v2M10 11v2" />
    </>
  ),
  maneuvering: (
    <>
      <path d="M4 8c4-4 9 0 14-2" />
      <path d="M4 18c4-4 9 0 14-2" />
      <path d="M15 3l3 3-3 3" />
    </>
  ),
  ability: <path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z" />,
  part: <path d="M12 3l7.5 4.5v9L12 21l-7.5-4.5v-9z" />,
  fault: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17v.5" />
    </>
  ),
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}

/** Panel title with a rule under it, and an optional bold subtitle, as on the game's build screen. */
export function PanelHeading({ title, aside, sub }: { title: string; aside?: ReactNode; sub?: ReactNode }) {
  return (
    <>
      <h2 className="panel-title">
        <span>{title}</span>
        {aside !== undefined && <span className="aside">{aside}</span>}
      </h2>
      {sub && <div className="panel-sub">{sub}</div>}
    </>
  );
}

export const TipLogo = () => (
  <span className="logo" aria-hidden>
    TIPR
  </span>
);

/** One key-hint chip, like the footer of the game's build screen. */
export const Key = ({ k, children, onClick }: { k: string; children: ReactNode; onClick?: () => void }) => (
  <button className="key" onClick={onClick}>
    <kbd>{k}</kbd>
    {children}
  </button>
);

/**
 * Speed plus the six stat rows and the Max Energy dots. Pass `onSet` to make the boxes clickable;
 * without it the rows are read-only (shared builds, compare).
 */
export function StatRows({
  cls,
  tuning,
  onSet,
}: {
  cls: VehicleClass;
  tuning: Record<StatId, number>;
  onSet?: (stat: StatId, boxes: number) => void;
}) {
  const energy = maxEnergy(tuning);
  return (
    <>
      <div className="speed">
        <Icon name="speed" />
        <span>Speed</span>
        <b>{topSpeed(cls.baseSpeed, tuning, cls.id === 'podracer')}</b>
      </div>
      {STAT_IDS.map((stat) => (
        <div className="stat" key={stat}>
          <Icon name={stat} />
          <div className="stat-main">
            <span className="stat-name">{stat === 'maneuvering' ? cls.maneuveringName : STAT_LABEL[stat]}</span>
            <div className="boxes" role={onSet ? 'group' : undefined} aria-label={onSet ? `${stat} boxes` : undefined}>
              {Array.from({ length: MAX_BOXES_PER_STAT }, (_, i) =>
                onSet ? (
                  <button
                    key={i}
                    className={i < tuning[stat] ? 'box on' : 'box'}
                    aria-label={`Set ${stat} to ${i + 1}`}
                    onClick={() => onSet(stat, tuning[stat] === i + 1 ? i : i + 1)}
                  />
                ) : (
                  <span key={i} className={i < tuning[stat] ? 'box on' : 'box'} />
                ),
              )}
              {[0, 1, 2].map((i) => (
                <span key={i} className="box big" title="Filled by in-tour +1 upgrades" />
              ))}
            </div>
          </div>
        </div>
      ))}
      <div className="energy" title="Base 3, plus about 1 per Battery box (estimate)">
        <span className="stat-name">Max Energy</span>
        <div className="dots" aria-label={`Max energy about ${energy}`}>
          {Array.from({ length: MAX_ENERGY_SCALE }, (_, i) => (
            <span key={i} className={i < energy ? 'dot on' : 'dot'} />
          ))}
        </div>
      </div>
    </>
  );
}

/** An installed part: icon, name, effect, and (optionally) the Fault it carries in the game's red box. */
export function PartRow({
  part,
  fault,
  keywordRe,
  onRemove,
  onFault,
  onClearFault,
}: {
  part: Part;
  fault?: Part;
  keywordRe: RegExp | null;
  onRemove?: () => void;
  onFault?: () => void;
  onClearFault?: () => void;
}) {
  return (
    <li className={`part ${part.rarity}`}>
      <div className="part-icon">
        <Icon name="part" size={26} />
        {fault && (
          <span className="part-warn">
            <Icon name="fault" size={14} />
          </span>
        )}
      </div>
      <div className="part-main">
        <h3>{part.name}</h3>
        <p>{highlight(part.text, keywordRe)}</p>
        {fault &&
          (onClearFault ? (
            <button className="downside" title={`${fault.name} (click to remove)`} onClick={onClearFault}>
              {highlight(fault.text, keywordRe)}
            </button>
          ) : (
            <p className="downside">{highlight(fault.text, keywordRe)}</p>
          ))}
        {!fault && onFault && (
          <button className="link" onClick={onFault}>
            + Add a fault (optional)
          </button>
        )}
      </div>
      {onRemove && (
        <button className="x" aria-label={`Remove ${part.name}`} onClick={onRemove}>
          ×
        </button>
      )}
    </li>
  );
}

export type { InstalledPart };
