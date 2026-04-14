-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 020: Add missing columns to otp_request_log
--
-- The initial migration (0000) created otp_request_log without:
--   - last_attempt_at   (timestamp for exponential backoff)
--   - consecutive_failures (failure count for backoff, resets on success)
--
-- These columns are defined in the Drizzle schema but were never applied to the DB.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "otp_request_log"
  ADD COLUMN IF NOT EXISTS "last_attempt_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "consecutive_failures" smallint NOT NULL DEFAULT 0;
