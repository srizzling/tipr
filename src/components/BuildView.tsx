import { useEffect, useMemo, useState } from 'react';
import { decodeBuild } from '../lib/build';
import { gameData } from '../data';
import { BuildNotFound, SharedBuild } from './SharedBuild';

/** Read-only page for a shared build: /b/<code>. */
export default function BuildView() {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => setCode(location.pathname.replace(/^\/b\//, '').replace(/\/$/, '')), []);

  const build = useMemo(() => (code ? decodeBuild(code) : null), [code]);

  if (code === null) return null;
  if (!build) return <BuildNotFound />;
  return (
    <SharedBuild
      build={build}
      code={code}
      data={gameData}
      copied={copied}
      onCopy={async () => {
        await navigator.clipboard.writeText(location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    />
  );
}
