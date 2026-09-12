-- Public links are created only when a person explicitly chooses to share a
-- summary. The public page deliberately contains no account, tag, note, or
-- dashboard information.
CREATE TABLE IF NOT EXISTS public_share_links (
  token TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(owner_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_public_share_links_owner
  ON public_share_links(owner_user_id, created_at DESC);

-- A recipient can save each shared Brief once. This prevents accidental
-- duplicates while keeping the original sharer's library private.
CREATE TABLE IF NOT EXISTS public_share_link_saves (
  share_token TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (share_token, user_id),
  FOREIGN KEY(share_token) REFERENCES public_share_links(token),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
