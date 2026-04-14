-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 021: Fix schema drift between Drizzle definitions and the database
--
-- Drift found:
--   1. otp_verification — missing req_id column (MSG91 request ID for replay prevention)
--   2. idempotency_log  — table missing entirely (sync push deduplication)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add req_id to otp_verification
ALTER TABLE "otp_verification"
  ADD COLUMN IF NOT EXISTS "req_id" text;

-- 2. Create idempotency_log (offline sync push deduplication)
CREATE TABLE IF NOT EXISTS "idempotency_log" (
  "key"          text PRIMARY KEY,
  "processed_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idempotency_log_processed_idx"
  ON "idempotency_log" ("processed_at");
