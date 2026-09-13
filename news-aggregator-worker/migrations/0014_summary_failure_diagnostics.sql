-- Keep troubleshooting data deliberately narrow. A failure is linked to the
-- account only so the Brief owner can identify a repeated product problem.
-- Never store a raw provider error, source text, title, URL, or search term.
ALTER TABLE product_events ADD COLUMN failure_code TEXT;

CREATE INDEX IF NOT EXISTS idx_product_events_failure_created
  ON product_events(event_name, failure_code, created_at DESC);
