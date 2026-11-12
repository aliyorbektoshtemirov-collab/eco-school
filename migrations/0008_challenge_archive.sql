-- Vazifa olib tashlanganda topshiriqlar va ballar yo'qolmasin:
-- o'chirish o'rniga arxivlanadi.
ALTER TABLE challenges ADD COLUMN archived_at TEXT;
CREATE INDEX IF NOT EXISTS idx_challenges_active ON challenges(school_id, archived_at);
