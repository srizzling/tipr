import { totalBoxes, tuningCost, vehicleLevel, type Build } from '../lib/build';
import type { GameData } from '../data/types';
import BuildPanels from './BuildPanels';
import { TipLogo, VerdictStrip } from './ui';
import { buildVerdict } from '../lib/verdict';

/** The read-only build page. Pure markup, so the Pages Function can render it on the server too. */
export function SharedBuild({
  build,
  code,
  data,
  copied = false,
  onCopy,
  imageLabel = 'Save image',
  onImage,
}: {
  build: Build;
  code: string;
  data: GameData;
  copied?: boolean;
  onCopy?: () => void;
  imageLabel?: string;
  onImage?: () => void;
}) {
  const cls = data.vehicleClasses.find((c) => c.id === build.classId);
  if (!cls) return <BuildNotFound />;
  return (
    <div className="planner">
      <header className="planner-head">
        <h1>
          <span className="slash">/</span>BUILD
          <TipLogo />
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
          <a className="pill action" href={`/compare?a=${code}`}>
            Compare
          </a>
          <button className="pill action" onClick={onImage}>
            {imageLabel}
          </button>
          <button className="pill action" onClick={onCopy}>
            {copied ? 'Link copied' : 'Copy link'}
          </button>
        </div>
      </header>

      <VerdictStrip verdict={buildVerdict(build, data)} />

      <BuildPanels build={build} data={data} />
    </div>
  );
}

export function BuildNotFound() {
  return (
    <div className="planner">
      <section className="panel">
        <h2>Build not found</h2>
        <p>This link isn't a valid build. It may have been cut off when it was copied.</p>
        <p className="mt">
          <a className="pill action" href="/">
            Start a new build
          </a>
        </p>
      </section>
    </div>
  );
}
