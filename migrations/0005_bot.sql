-- Bot: suhbat holati va kichik texnik sozlamalar

-- Webhook holati kabi narsalar shu yerda saqlanadi
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Botdagi ko'p bosqichli suhbat: ro'yxatdan o'tish va kirish.
-- Parol bu yerda saqlanmaydi — faqat qaysi bosqichda ekani va ism/sinf.
CREATE TABLE IF NOT EXISTS telegram_states (
  chat_id    TEXT PRIMARY KEY,
  step       TEXT NOT NULL,
  data       TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
