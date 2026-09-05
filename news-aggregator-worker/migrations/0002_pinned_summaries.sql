ALTER TABLE summaries ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_summaries_user_pinned_created ON summaries(user_id, is_pinned DESC, created_at DESC);
