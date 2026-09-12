-- A user can sign in from more than one browser or device at a time. Keeping
-- sessions separate prevents a new login from invalidating an existing device.
CREATE TABLE IF NOT EXISTS user_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_expiry
  ON user_sessions(user_id, expires_at);

-- Preserve current sessions during the rollout. The legacy columns remain as a
-- read-only fallback until a later cleanup migration, so this is safe even if a
-- deployment briefly reaches code before this migration in another environment.
INSERT OR IGNORE INTO user_sessions (token, user_id, expires_at)
SELECT session_token, id, COALESCE(session_expires_at, datetime('now', '+30 days'))
FROM users
WHERE session_token IS NOT NULL AND TRIM(session_token) != '';
