CREATE TABLE IF NOT EXISTS user_product_feedback (
  user_id TEXT PRIMARY KEY,
  intended_use TEXT,
  intended_use_skipped_at TIMESTAMP,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  rating_comment TEXT,
  feedback_skipped_at TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
