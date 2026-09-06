ALTER TABLE users ADD COLUMN last_active_at TIMESTAMP;

UPDATE users
SET last_active_at = created_at
WHERE last_active_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_last_active_at ON users(last_active_at);

CREATE TABLE IF NOT EXISTS user_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('bug', 'idea', 'question')),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 1000),
  page_url TEXT,
  source TEXT NOT NULL DEFAULT 'dashboard' CHECK (source IN ('dashboard', 'extension')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'planned', 'resolved')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_reports_status_created ON user_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_reports_user_created ON user_reports(user_id, created_at DESC);
