-- Marafon: bir necha kun davom etadigan challenge.
-- Har kuni o'z vazifasi bor, o'quvchi qo'shiladi va har kuni belgilaydi.

CREATE TABLE IF NOT EXISTS marathons (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id      INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  title          TEXT    NOT NULL,
  description    TEXT    NOT NULL DEFAULT '',
  days           INTEGER NOT NULL DEFAULT 30,
  points_per_day INTEGER NOT NULL DEFAULT 10,
  bonus_points   INTEGER NOT NULL DEFAULT 0,   -- hammasini bajarganga qo'shimcha
  start_date     TEXT    NOT NULL,             -- YYYY-MM-DD
  status         TEXT    NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'finished')),
  created_by     INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Har kunning o'z vazifasi. Kiritilmasa, o'sha kun uchun umumiy matn ishlatiladi.
CREATE TABLE IF NOT EXISTS marathon_days (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  marathon_id INTEGER NOT NULL REFERENCES marathons(id) ON DELETE CASCADE,
  day_number  INTEGER NOT NULL,
  title       TEXT    NOT NULL,
  UNIQUE (marathon_id, day_number)
);

CREATE TABLE IF NOT EXISTS marathon_participants (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  marathon_id INTEGER NOT NULL REFERENCES marathons(id) ON DELETE CASCADE,
  student_id  INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (marathon_id, student_id)
);

-- Kunlik belgilash. Bir kun — bitta yozuv, takrorlab bo'lmaydi.
CREATE TABLE IF NOT EXISTS marathon_checkins (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  marathon_id    INTEGER NOT NULL REFERENCES marathons(id) ON DELETE CASCADE,
  student_id     INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_number     INTEGER NOT NULL,
  note           TEXT,
  photo          TEXT,
  awarded_points INTEGER NOT NULL DEFAULT 0,
  source         TEXT    NOT NULL DEFAULT 'web',  -- web | bot
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (marathon_id, student_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_marathon_active
  ON marathons(status, start_date);
CREATE INDEX IF NOT EXISTS idx_checkins_student
  ON marathon_checkins(marathon_id, student_id);
