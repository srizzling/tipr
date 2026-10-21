import { useEffect, useMemo, useState } from 'react';
import { decodeBuild, totalBoxes, tuningCost, vehicleLevel, type Build } from '../lib/build';
import { gameData } from '../data';
import BuildPanels from './BuildPanels';

/** Read-only page for a shared build: /b/<code>. */
export default function BuildView() {
  const data = gameData;
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => setCode(location.pathname.replace(/^\/b\//, '').replace(/\/$/, '')), []);

  const build: Build | null = useMemo(() => (code ? decodeBuild(code) : null), [code]);

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
          <a className="pill action" href={`/compare?a=${code}`}>
            Compare
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

      <BuildPanels build={build} data={data} />
    </div>
  );
}
