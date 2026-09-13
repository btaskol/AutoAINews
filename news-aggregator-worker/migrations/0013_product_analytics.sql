-- Product analytics deliberately contain no captured page text, titles, URLs,
-- search terms, IP addresses, age, gender, or location. They measure only the
-- product actions needed to improve Brief and operate the beta safely.
CREATE TABLE IF NOT EXISTS product_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  event_name TEXT NOT NULL CHECK (event_name IN (
    'summary_requested', 'summary_succeeded', 'summary_failed',
    'summary_saved', 'share_created', 'share_opened', 'share_copy_saved'
  )),
  summary_language TEXT,
  summary_mode TEXT,
  duration_ms INTEGER,
  share_token TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_product_events_name_created ON product_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_events_user_created ON product_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_events_language_mode ON product_events(summary_language, summary_mode, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_events_share_token ON product_events(share_token, created_at DESC);

-- A user can rate a generated summary without attaching its title, source, or
-- text to the feedback record.
CREATE TABLE IF NOT EXISTS summary_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  helpful INTEGER NOT NULL CHECK (helpful IN (0, 1)),
  comment TEXT CHECK (length(comment) <= 1200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_summary_feedback_created ON summary_feedback(created_at DESC);
