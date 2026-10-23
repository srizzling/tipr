import { useCallback, useEffect, useState, type SyntheticEvent } from 'react';
import { combinedBoxes, decodeBuild, topSpeed, vehicleLevel, type Build } from '../lib/build';
import { gameData as data } from '../data';
import { VIDEO_HOSTS, validateSubmission, videoHostLabel, type BoardEntry } from '../lib/board';
import { loadGarage, type SavedBuild } from '../lib/garage';
import { buildVerdict } from '../lib/verdict';
import { discoverCode, discoverEntries, redditEmbedUrl, type DiscoverEntry } from '../lib/discover';

const REPORTED_KEY = 'tipr:reported';
const nameOf = (list: { id: string; name: string }[], id: string | null) => list.find((x) => x.id === id)?.name;
const isKnownClass = (id: string) => data.vehicleClasses.some((c) => c.id === id);

interface Page {
  entries: BoardEntry[];
  next: number | null;
}

/** One card on the board: a player's submission (from the API) or a build spotted on Reddit (hand-picked, bundled). */
type Item =
  | { kind: 'player'; key: string; time: number; entry: BoardEntry }
  | { kind: 'reddit'; key: string; time: number; entry: DiscoverEntry };

const redditItems: Item[] = discoverEntries.map((entry) => ({
  kind: 'reddit',
  key: `reddit-${entry.id}`,
  time: Date.parse(entry.posted) / 1000,
  entry,
}));

/** Ability and part names for a card, with the fault under a part that carries one. */
function loadout(b: Pick<Build, 'abilities' | 'crashAbility' | 'parts'>) {
  const abilities = [...b.abilities, b.crashAbility].map((id) => nameOf(data.abilities, id)).filter((n): n is string => !!n);
  const parts = b.parts.map((p) => ({ name: nameOf(data.parts, p.id) ?? p.id, fault: p.fault ? nameOf(data.parts, p.fault) : undefined }));
  return { abilities, parts };
}

function Loadout({ build }: { build: Pick<Build, 'abilities' | 'crashAbility' | 'parts'> }) {
  const { abilities, parts } = loadout(build);
  return (
    <>
      <p className="sub">
        <b>Abilities:</b> {abilities.join(' · ') || 'None'}
      </p>
      <p className="sub">
        <b>Parts:</b>{' '}
        {parts.length === 0
          ? 'None'
          : parts.map((p, i) => (
              <span key={i}>
                {i > 0 && ' · '}
                {p.name}
                {p.fault && <span className="fault-tag"> (fault: {p.fault})</span>}
              </span>
            ))}
      </p>
    </>
  );
}

/** Builds the community has shared with a video. Anyone can add one; anyone can report one. */
export default function Builds() {
  const [entries, setEntries] = useState<BoardEntry[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [more, setMore] = useState(false);
  const [reported, setReported] = useState<number[]>([]);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Reddit posts the visitor chose to load here. Nothing is requested from Reddit until they do.
  const [embedded, setEmbedded] = useState<string[]>([]);

  const [garage, setGarage] = useState<SavedBuild[]>([]);
  const [build, setBuild] = useState('');
  const [video, setVideo] = useState('');
  const [trap, setTrap] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const fetchPage = useCallback(async (before: number | null, fresh = false): Promise<Page | null> => {
    try {
      const res = await fetch(before ? `/api/builds?before=${before}` : '/api/builds', fresh ? { cache: 'no-cache' } : undefined);
      if (!res.ok) return null;
      return (await res.json()) as Page;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    setGarage(loadGarage(localStorage));
    try {
      const saved = JSON.parse(localStorage.getItem(REPORTED_KEY) ?? '[]');
      if (Array.isArray(saved)) setReported(saved.filter((n): n is number => Number.isSafeInteger(n)));
    } catch {
      /* ignore a corrupted list */
    }
    // /builds/?add=<code> comes from the "Add a video" button on a build page.
    const add = new URLSearchParams(location.search).get('add');
    if (add) setBuild(`${location.origin}/b/${add}`);
    fetchPage(null).then((page) => {
      if (!page) return setLoadError(true);
      setEntries(page.entries);
      setNext(page.next);
    });
  }, [fetchPage]);

  async function submit(ev: SyntheticEvent) {
    ev.preventDefault();
    setNotice(null);
    const check = validateSubmission({ build, video }, isKnownClass);
    if (!check.ok) return setError(check.error);
    setError(null);
    setSending(true);
    try {
      const res = await fetch('/api/builds', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ build, video, website: trap }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; duplicate?: boolean };
      if (!res.ok) return setError(body.error ?? 'Something went wrong. Try again.');
      setNotice(body.duplicate ? 'That build and video are already on the board.' : 'Added. It is at the top of the board.');
      setBuild('');
      setVideo('');
      const page = await fetchPage(null, true);
      if (page) {
        setEntries(page.entries);
        setNext(page.next);
      }
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setSending(false);
    }
  }

  async function report(id: number) {
    setConfirming(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/builds/${id}/report`, { method: 'POST' });
      if (!res.ok && res.status !== 404) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        return setNotice(body.error ?? 'Could not send that report. Try again.');
      }
      // Gone for this visitor straight away, whatever the count is.
      const list = [...reported, id];
      setReported(list);
      localStorage.setItem(REPORTED_KEY, JSON.stringify(list.slice(-500)));
      setNotice('Reported, thanks. It is hidden for you, and gone for everyone once a few people report it.');
    } catch {
      setNotice('Could not send that report. Try again.');
    }
  }

  async function loadMore() {
    if (next === null) return;
    setMore(true);
    const page = await fetchPage(next);
    setMore(false);
    if (!page) return setNotice('Could not load more. Try again.');
    setEntries((prev) => [...(prev ?? []), ...page.entries]);
    setNext(page.next);
  }

  // Player submissions arrive newest first, a page at a time. Reddit builds are merged in by date, but only back to the
  // oldest player entry loaded so far, so loading more never makes an older Reddit build jump in above newer ones.
  const players = (entries ?? []).filter((e) => !reported.includes(e.id));
  const oldestLoaded = entries && entries.length > 0 ? entries[entries.length - 1].createdAt : 0;
  const ready = entries !== null || loadError;
  const items: Item[] = [
    ...players.map((entry): Item => ({ kind: 'player', key: `player-${entry.id}`, time: entry.createdAt, entry })),
    ...redditItems.filter((r) => next === null || r.time >= oldestLoaded),
  ].sort((a, b) => b.time - a.time);

  return (
    <>
      <section className="panel">
        <h2 className="panel-title">
          <span>Add your build</span>
        </h2>
        <form className="board-form" onSubmit={submit} noValidate>
          <label>
            <span className="label">Build link</span>
            <input
              className="field plain"
              value={build}
              onChange={(e) => setBuild(e.target.value)}
              placeholder="Paste the link from the planner's Copy link button"
              inputMode="url"
              autoComplete="off"
              maxLength={2300}
            />
          </label>
          {garage.length > 0 && (
            <label>
              <span className="label">Or pick one from your garage</span>
              <select
                className="field plain"
                value=""
                onChange={(e) => e.target.value && setBuild(`${location.origin}/b/${e.target.value}`)}
              >
                <option value="">Choose a saved build…</option>
                {garage.map((g) => (
                  <option key={g.id} value={g.code}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span className="label">Video link</span>
            <input
              className="field plain"
              value={video}
              onChange={(e) => setVideo(e.target.value)}
              placeholder="https://youtu.be/…"
              inputMode="url"
              autoComplete="off"
              maxLength={600}
            />
          </label>
          {/* Hidden from people, tempting to bots. */}
          <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={trap} onChange={(e) => setTrap(e.target.value)} />
          <p className="hint tight">
            Links from {VIDEO_HOSTS.join(', ')}. They go live straight away, so only add your own builds. We never host the video, we only link to it.
          </p>
          <div className="board-send">
            <button className="pill action" type="submit" disabled={sending}>
              {sending ? 'Adding…' : 'Add to the board'}
            </button>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </form>
      </section>

      <section className="panel" aria-live="polite">
        <h2 className="panel-title">
          <span>All builds</span>
          {ready && <span className="aside">{items.length}{next !== null ? '+' : ''}</span>}
        </h2>
        {notice && <p className="board-notice">{notice}</p>}

        {loadError && <p className="hint">Player submissions could not be loaded. Try again in a moment.</p>}
        {!ready && <p className="hint">Loading the board…</p>}
        {ready && items.length === 0 && <p>Nothing here yet. Add the first one above.</p>}

        <div className="garage-list">
          {items.map((item) => {
            if (item.kind === 'reddit') {
              const e = item.entry;
              const cls = nameOf(data.vehicleClasses, e.build.classId);
              const style = nameOf(data.racerStyles, e.build.styleId);
              const embedUrl = redditEmbedUrl(e.post);
              const isEmbedded = embedded.includes(e.id);
              return (
                <article className="garage-item" key={item.key}>
                  <h3>
                    {style ?? cls}
                    <span className="src-tag">From Reddit</span>
                  </h3>
                  <p className="sub">
                    {cls} · Level {vehicleLevel(e.build.tuning)} ·{' '}
                    {topSpeed(data.vehicleClasses.find((c) => c.id === e.build.classId)?.baseSpeed ?? 0, combinedBoxes(e.build.tuning, e.build.bonus))} km/h
                  </p>
                  <p className="sub">
                    {style && `${style} rank ${e.build.styleRank} · `}by <b>u/{e.author}</b> on Reddit, {e.posted}
                  </p>
                  <p className="verdict-mini">{e.note}</p>
                  <Loadout build={e.build} />
                  <div className="garage-actions">
                    {embedUrl && (
                      <button
                        aria-expanded={isEmbedded}
                        onClick={() => setEmbedded((list) => (list.includes(e.id) ? list.filter((x) => x !== e.id) : [...list, e.id]))}
                      >
                        {isEmbedded ? 'Hide it' : e.media === 'video' ? 'Watch the video here' : 'Show the screenshot here'}
                      </button>
                    )}
                    <a href={e.post} target="_blank" rel="noopener noreferrer">
                      Read the post on Reddit ↗
                    </a>
                    <a href={`/?b=${discoverCode(e)}`}>Open in planner</a>
                  </div>
                  {embedUrl && !isEmbedded && <p className="hint tight">Loads from Reddit, so Reddit sees your visit.</p>}
                  {embedUrl && isEmbedded && (
                    <iframe
                      className="reddit-frame"
                      src={embedUrl}
                      title={`Reddit post: ${e.title}`}
                      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                      referrerPolicy="no-referrer"
                      allow="fullscreen"
                      allowFullScreen
                    />
                  )}
                </article>
              );
            }

            const e = item.entry;
            const b = decodeBuild(e.code);
            const cls = b && data.vehicleClasses.find((c) => c.id === b.classId);
            if (!b || !cls) return null;
            const verdict = buildVerdict(b, data);
            return (
              <article className="garage-item" key={item.key}>
                <h3>{nameOf(data.racerStyles, b.styleId) ?? cls.name}</h3>
                <p className="sub">
                  {cls.name} · Level {vehicleLevel(b.tuning)} · {topSpeed(cls.baseSpeed, combinedBoxes(b.tuning, b.bonus), cls.id === 'podracer')} km/h
                </p>
                <p className="verdict-mini">
                  <b>{verdict.title}.</b> {verdict.line}
                </p>
                <Loadout build={b} />
                <div className="garage-actions">
                  {/* User-submitted, so it never passes ranking or the page's referrer on. */}
                  <a href={e.url} target="_blank" rel="nofollow ugc noopener noreferrer">
                    Watch on {videoHostLabel(e.url)} ↗
                  </a>
                  <a href={`/b/${e.code}`}>View build</a>
                  <a href={`/?b=${e.code}`}>Edit</a>
                  <a href={`/compare/?a=${e.code}`}>Compare</a>
                  {confirming === e.id ? (
                    <>
                      <span className="hint">Report this link?</span>
                      <button className="danger" onClick={() => report(e.id)}>
                        Yes, report
                      </button>
                      <button onClick={() => setConfirming(null)}>Cancel</button>
                    </>
                  ) : (
                    <button className="danger" onClick={() => setConfirming(e.id)}>
                      Report
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {next !== null && (
          <p className="gap-top">
            <button className="pill action" onClick={loadMore} disabled={more}>
              {more ? 'Loading…' : 'Load more'}
            </button>
          </p>
        )}
      </section>
    </>
  );
}
