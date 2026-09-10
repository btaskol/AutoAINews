-- Collections are intentionally limited to one optional child level. They give
-- people a stable place for groups of briefs, while tags remain free-form.
CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(parent_id) REFERENCES collections(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_unique_name
  ON collections(user_id, COALESCE(parent_id, -1), name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_collections_user_parent
  ON collections(user_id, parent_id);

ALTER TABLE summaries ADD COLUMN collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_summaries_collection ON summaries(collection_id);
