-- 018: Sync Infrastructure for PowerSync Offline-First Mobile
-- Creates idempotency_log table and configures WAL for PowerSync replication.

-- Idempotency log: prevents duplicate processing during sync push retries.
-- PowerSync retries failed uploads automatically. Without this table,
-- a crash between the mutation and the log write causes re-processing.
-- TTL: 7 days (cleaned by pg_cron).
CREATE TABLE IF NOT EXISTS idempotency_log (
  key          TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idempotency_log_processed_idx
  ON idempotency_log (processed_at);

-- WAL configuration for PowerSync logical replication.
-- PowerSync reads changes from PostgreSQL's write-ahead log to sync
-- data to mobile SQLite databases.
-- NOTE: Changing wal_level requires a PostgreSQL restart.
-- Run these on your PostgreSQL instance (not via migration runner):
--
--   ALTER SYSTEM SET wal_level = logical;
--   ALTER SYSTEM SET max_replication_slots = 10;
--   SELECT pg_reload_conf();
--
-- For managed PostgreSQL (Neon, Supabase, AWS RDS):
-- Enable logical replication in the provider's dashboard.

-- Cleanup cron jobs (schedule via pg_cron or application cron):
--
--   -- Run daily: delete tombstones older than 90 days
--   DELETE FROM <syncable_table>
--     WHERE deleted_at IS NOT NULL
--     AND   deleted_at < NOW() - INTERVAL '90 days';
--
--   -- Run daily: delete idempotency entries older than 7 days
--   DELETE FROM idempotency_log
--     WHERE processed_at < NOW() - INTERVAL '7 days';
