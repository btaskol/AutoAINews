CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  picture TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  subscription_status TEXT DEFAULT 'trial',
  stripe_customer_id TEXT,
  session_token TEXT,
  session_expires_at TIMESTAMP,
  role TEXT DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS used_trials (
  email TEXT PRIMARY KEY,
  first_registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  custom_title TEXT,
  comment TEXT,
  url TEXT NOT NULL,
  summary TEXT NOT NULL,
  snapshot_key TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
