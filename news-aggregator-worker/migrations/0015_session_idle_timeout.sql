-- Sessions remain valid for 30 days at most, but require use at least once
-- every 14 days. Existing sessions start their inactivity window from when
-- they were created, which avoids extending an old session silently.
ALTER TABLE user_sessions ADD COLUMN last_seen_at TIMESTAMP;

UPDATE user_sessions
SET last_seen_at = created_at
WHERE last_seen_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_sessions_last_seen
  ON user_sessions(last_seen_at);
