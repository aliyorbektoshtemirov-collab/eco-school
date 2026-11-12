CREATE TABLE submission_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  submission_type TEXT NOT NULL CHECK (submission_type IN ('challenge', 'recycling')),
  submission_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  read_at TEXT
);
CREATE INDEX idx_notifications_recipient ON submission_notifications(recipient_id, id DESC);
CREATE INDEX idx_notifications_thread ON submission_notifications(submission_type, submission_id, id);
