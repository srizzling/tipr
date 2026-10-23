-- The public builds board: a share code plus a link to a video of it.
CREATE TABLE builds (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT    NOT NULL,
  url        TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  reports    INTEGER NOT NULL DEFAULT 0,
  hidden     INTEGER NOT NULL DEFAULT 0,
  -- The same video for the same build is listed once, and a hidden entry cannot be resubmitted back into view.
  UNIQUE (code, url)
);

-- The board only ever reads visible rows, newest first, so index exactly those: a page costs about 50 rows read.
CREATE INDEX builds_visible ON builds (id DESC) WHERE hidden = 0;

-- One row per person per build. Counting these is what hides a link.
-- `reporter` is a short one-way hash of the visitor's IP address, never the address itself.
CREATE TABLE reports (
  build_id INTEGER NOT NULL REFERENCES builds (id) ON DELETE CASCADE,
  reporter TEXT    NOT NULL,
  PRIMARY KEY (build_id, reporter)
) WITHOUT ROWID;

-- Rolling log for rate limits ('submit' and 'report'), pruned as it is written.
CREATE TABLE actions (
  kind TEXT    NOT NULL,
  who  TEXT    NOT NULL,
  at   INTEGER NOT NULL
);
CREATE INDEX actions_lookup ON actions (kind, who, at);
CREATE INDEX actions_age ON actions (at);
