-- ECO SCHOOL — D1 sxemasi
-- Asl Supabase modelining aynan o'zi: maktablar, sinflar, profillar,
-- challenge'lar, recycling, tadqiqotlar va taqvim.

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------------ maktablar
CREATE TABLE IF NOT EXISTS schools (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,          -- ro'yxatdan o'tishda kiritiladi
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS school_classes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id   INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_name  TEXT NOT NULL,
  UNIQUE (school_id, class_name)
);

-- ------------------------------------------------------------------ profillar
CREATE TABLE IF NOT EXISTS profiles (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT NOT NULL UNIQUE,       -- kichik harflarda
  password_hash  TEXT NOT NULL,
  password_salt  TEXT NOT NULL,
  password_iter  INTEGER NOT NULL DEFAULT 100000,
  full_name      TEXT NOT NULL,
  class_name     TEXT,
  school_id      INTEGER REFERENCES schools(id) ON DELETE SET NULL,
  school_code    TEXT,
  role           TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin','owner')),
  points         INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_profiles_school ON profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_profiles_points ON profiles(points DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_class  ON profiles(school_id, class_name);

-- ------------------------------------------------------------------ sessiyalar
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,              -- sha256(token)
  user_id     INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ------------------------------------------------------------------ rate limit
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket    TEXT PRIMARY KEY,
  hits      INTEGER NOT NULL DEFAULT 0,
  reset_at  INTEGER NOT NULL
);

-- ------------------------------------------------------------------ challenge'lar
CREATE TABLE IF NOT EXISTS challenges (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT 'UMUMIY',
  points      INTEGER NOT NULL DEFAULT 10,
  end_date    TEXT,
  school_id   INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS challenge_submissions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id   INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  student_id     INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  proof_text     TEXT,
  proof_url      TEXT,                        -- R2 kaliti
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  awarded_points INTEGER NOT NULL DEFAULT 0,
  reviewed_by    INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  submitted_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cs_student ON challenge_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_cs_status  ON challenge_submissions(status, submitted_at DESC);

-- ------------------------------------------------------------------ recycling
CREATE TABLE IF NOT EXISTS recycling_submissions (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id          INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id         INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  material           TEXT NOT NULL CHECK (material IN ('paper','plastic')),
  amount_kg          REAL NOT NULL CHECK (amount_kg > 0),
  verified_amount_kg REAL,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  awarded_points     INTEGER NOT NULL DEFAULT 0,
  proof_image        TEXT,                    -- R2 kaliti
  reviewed_by        INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  submitted_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rs_student ON recycling_submissions(student_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_rs_school  ON recycling_submissions(school_id, submitted_at DESC);

-- ------------------------------------------------------------------ tadqiqotlar
CREATE TABLE IF NOT EXISTS eco_research (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id        INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  summary           TEXT NOT NULL,
  content           TEXT NOT NULL,
  sources           TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected')),
  awarded_points    INTEGER NOT NULL DEFAULT 0,
  reviewer_feedback TEXT,
  reviewed_by       INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  submitted_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_er_status ON eco_research(status, submitted_at DESC);

-- ------------------------------------------------------------------ taqvim
CREATE TABLE IF NOT EXISTS eco_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  description TEXT,
  event_type  TEXT NOT NULL DEFAULT 'event' CHECK (event_type IN ('event','challenge','eco_day')),
  start_date  TEXT NOT NULL,
  end_date    TEXT,
  location    TEXT,
  school_id   INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  created_by  INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ev_date ON eco_events(start_date);
