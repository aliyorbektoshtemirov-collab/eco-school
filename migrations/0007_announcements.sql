-- Adminlardan e'lon: saytda banner, botga xabar

CREATE TABLE IF NOT EXISTS announcements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id  INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  title      TEXT    NOT NULL,
  body       TEXT    NOT NULL DEFAULT '',
  link       TEXT,
  pinned     INTEGER NOT NULL DEFAULT 1,   -- saytda banner bo'lib tursinmi
  sent_count INTEGER NOT NULL DEFAULT 0,   -- botga nechtasiga yetkazildi
  created_by INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_announcements_new
  ON announcements(school_id, created_at DESC);
