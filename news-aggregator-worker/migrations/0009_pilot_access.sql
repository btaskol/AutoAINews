-- Explicit invitation list for private development, beta, and production environments.
-- The Worker enforces this only when ACCESS_MODE is set to "allowlist".
CREATE TABLE IF NOT EXISTS pilot_access (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  added_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pilot_access_created_at ON pilot_access(created_at DESC);
