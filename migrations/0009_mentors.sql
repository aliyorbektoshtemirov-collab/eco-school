-- Mentorlar: owner rasm va ma'lumot yuklaydi, hamma ko'radi (sayt, ilova, bot).
CREATE TABLE IF NOT EXISTS mentors (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name  TEXT    NOT NULL,
  title      TEXT,
  bio        TEXT,
  photo_key  TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
