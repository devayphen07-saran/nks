-- ─── Migration 043: plans — partial unique index on is_more_popular ───────────
--
-- Problem: multiple plans could have is_more_popular = true simultaneously,
-- causing the UI to render multiple "Most Popular" badges.
--
-- Fix: partial unique index on is_more_popular WHERE is_more_popular = true.
-- Because a unique index on a boolean column WHERE the value IS true means
-- only one such row can exist — any attempt to insert a second is_more_popular=true
-- row will fail with a unique constraint violation.

CREATE UNIQUE INDEX plans_is_more_popular_unique_idx
  ON plans (is_more_popular)
  WHERE is_more_popular = true AND deleted_at IS NULL;
