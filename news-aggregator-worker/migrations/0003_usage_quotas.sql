CREATE TABLE IF NOT EXISTS summary_usage (
  user_id TEXT NOT NULL,
  period_key TEXT NOT NULL,
  summary_count INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, period_key),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_summary_usage_user ON summary_usage(user_id, period_key);
