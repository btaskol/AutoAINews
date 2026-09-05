CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS summary_tags (
  summary_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(summary_id, tag_id),
  FOREIGN KEY(summary_id) REFERENCES summaries(id) ON DELETE CASCADE,
  FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tags_user_pinned ON tags(user_id, is_pinned DESC, name);
CREATE INDEX IF NOT EXISTS idx_summary_tags_tag ON summary_tags(tag_id, summary_id);

-- Preserve every existing single "custom title" as the first tag on its capture.
INSERT OR IGNORE INTO tags (user_id, name)
SELECT user_id, TRIM(custom_title)
FROM summaries
WHERE TRIM(COALESCE(custom_title, '')) <> '';

INSERT OR IGNORE INTO summary_tags (summary_id, tag_id)
SELECT summaries.id, tags.id
FROM summaries
JOIN tags ON tags.user_id = summaries.user_id
  AND tags.name = TRIM(summaries.custom_title) COLLATE NOCASE
WHERE TRIM(COALESCE(summaries.custom_title, '')) <> '';
