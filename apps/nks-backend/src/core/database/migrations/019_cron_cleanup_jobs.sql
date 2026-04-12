-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 019: pg_cron cleanup jobs
--
-- Schedules two daily maintenance jobs:
--   1. Purge soft-deleted routes older than 90 days (tombstone cleanup)
--   2. Purge processed idempotency_log entries older than 7 days
--
-- Prerequisites:
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   (requires pg_cron to be installed on the PostgreSQL instance)
--   On AWS RDS: enable via parameter group (shared_preload_libraries = pg_cron)
--   On Supabase: pg_cron is available in the dashboard → Database → Extensions
--
-- Run once per environment (dev, staging, prod) — idempotent via IF NOT EXISTS guards.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ─── Job 1: Tombstone cleanup for routes ─────────────────────────────────────
-- Removes routes where deleted_at is set AND older than 90 days.
-- Keeps recent tombstones so offline devices can observe deletions during sync.
SELECT cron.schedule(
  'nks-routes-tombstone-cleanup',          -- job name (unique identifier)
  '0 2 * * *',                             -- daily at 02:00 UTC
  $$
    DELETE FROM routes
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '90 days';
  $$
)
ON CONFLICT (jobname) DO UPDATE
  SET schedule = EXCLUDED.schedule,
      command  = EXCLUDED.command;

-- ─── Job 2: Idempotency log cleanup ──────────────────────────────────────────
-- Removes processed idempotency entries older than 7 days.
-- 7-day window safely covers any offline device that might retry within 3 days
-- (offline JWT window) plus a generous 4-day buffer.
SELECT cron.schedule(
  'nks-idempotency-log-cleanup',           -- job name
  '0 3 * * *',                             -- daily at 03:00 UTC (1h after routes)
  $$
    DELETE FROM idempotency_log
    WHERE processed_at < NOW() - INTERVAL '7 days';
  $$
)
ON CONFLICT (jobname) DO UPDATE
  SET schedule = EXCLUDED.schedule,
      command  = EXCLUDED.command;

-- ─── Verify jobs are scheduled ────────────────────────────────────────────────
-- SELECT jobid, jobname, schedule, command, active
-- FROM cron.job
-- WHERE jobname IN ('nks-routes-tombstone-cleanup', 'nks-idempotency-log-cleanup');
