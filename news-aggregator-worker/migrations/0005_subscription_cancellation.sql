-- Retain paid access during a customer-requested, end-of-period cancellation.
ALTER TABLE users ADD COLUMN cancel_at_period_end INTEGER NOT NULL DEFAULT 0;
