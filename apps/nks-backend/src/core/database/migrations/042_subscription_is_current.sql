-- ─── Migration 042: subscription — add is_current + partial unique index ──────
--
-- Problem: no constraint prevented two subscription rows for the same store
-- both being treated as the "current" active subscription simultaneously.
-- The evaluator had no DB-level guarantee of uniqueness — it had to pick one
-- arbitrarily or risk returning stale plan data.
--
-- Fix:
--   1. Add is_current boolean — semantic marker for the active subscription row.
--   2. Partial unique index ON (store_fk) WHERE is_current = true — DB-enforced
--      guarantee that at most one row per store can be current at any time.
--
-- Backfill: existing rows all default to is_current = false (safe — no active
-- subscriptions assumed in a pre-production environment). If migrating with live
-- data, run a separate backfill to set is_current = true on the correct rows
-- before enabling the unique index (drop the index, backfill, recreate).

ALTER TABLE subscription
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX subscription_current_store_unique_idx
  ON subscription (store_fk)
  WHERE is_current = true AND deleted_at IS NULL;
