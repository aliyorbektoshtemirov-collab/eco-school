-- Telegram bot: o'quvchi hisobini Telegram chat'iga bog'lash

ALTER TABLE profiles ADD COLUMN telegram_chat_id TEXT;
ALTER TABLE profiles ADD COLUMN telegram_link_code TEXT;
ALTER TABLE profiles ADD COLUMN telegram_code_expires TEXT;
ALTER TABLE profiles ADD COLUMN telegram_linked_at TEXT;

-- Bitta Telegram hisobi faqat bitta profilga bog'lanadi
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_tg
  ON profiles(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_tg_code
  ON profiles(telegram_link_code) WHERE telegram_link_code IS NOT NULL;
