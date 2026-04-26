-- ─── Migration 047: rate_limit_entries — add expires_at ───────────────────────
--
-- Problem: cleanup relied on windowStart + CLEANUP_TTL_MS computed in app code.
-- No index on expiry meant cleanup required a full table scan.
--
-- Fix: add expires_at (set to windowStart + window_duration at insert time).
-- Cleanup becomes: DELETE WHERE expires_at < NOW() — index-supported.
--
-- Backfill: set existing rows to windowStart + 15 minutes (the window duration).
-- Rows already past that time will be swept on the next cleanup pass.

ALTER TABLE rate_limit_entries
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE rate_limit_entries
  SET expires_at = window_start + INTERVAL '15 minutes'
  WHERE expires_at IS NULL;

ALTER TABLE rate_limit_entries
  ALTER COLUMN expires_at SET NOT NULL;

CREATE INDEX rate_limit_entries_expires_at_idx
  ON rate_limit_entries (expires_at);
