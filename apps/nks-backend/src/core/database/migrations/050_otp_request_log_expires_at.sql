-- ─── Migration 050: otp_request_log — add expires_at for row-level cleanup ────
--
-- windowExpiresAt tracks the 1-hour rate-limit window reset time.
-- expiresAt is a separate row-level TTL (24h from last window reset) so a
-- cron job can hard-delete stale rows with: DELETE WHERE expires_at < NOW().
--
-- Back-fill: existing rows get expires_at = window_expires_at + 23h (≈ 24h
-- from when the window was first opened), ensuring no row is deleted before
-- its window has had a chance to expire naturally.

ALTER TABLE otp_request_log
  ADD COLUMN expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE otp_request_log
  SET expires_at = window_expires_at + INTERVAL '23 hours';

ALTER TABLE otp_request_log
  ALTER COLUMN expires_at DROP DEFAULT;

CREATE INDEX otp_request_log_expires_at_idx ON otp_request_log (expires_at);
