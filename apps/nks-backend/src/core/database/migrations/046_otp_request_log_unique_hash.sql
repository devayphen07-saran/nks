-- ─── Migration 046: otp_request_log — UNIQUE on identifier_hash ───────────────
--
-- Problem: identifier_hash had only a plain index. Two concurrent OTP requests
-- from the same identifier could both find no existing row, both call INSERT,
-- and produce two rows — each passing the rate-limit check independently,
-- effectively doubling the allowed request count.
--
-- Fix: promote to a unique index. The repository's create() will now fail on
-- the second concurrent insert; the service must handle the conflict with
-- ON CONFLICT DO UPDATE (upsert) for full safety, but the constraint at minimum
-- prevents silent duplicate rows from reaching the rate-limit evaluator.

DROP INDEX IF EXISTS otp_request_log_identifier_hash_idx;

CREATE UNIQUE INDEX otp_request_log_identifier_hash_idx
  ON otp_request_log (identifier_hash);
