-- ─── Migration 035: Schema Fixes ──────────────────────────────────────────────
--
-- 1. notifications_retry_idx  — drop partial (hardcoded status IDs) → full index
-- 2. routes                   — add index on parent_route_fk for tree traversal
-- 3. address_type             — set is_shipping_applicable NOT NULL
-- 4. lookup_type              — set NOT NULL on has_table, is_active, is_custom_table

-- ─── 1. Notifications retry index ─────────────────────────────────────────────
-- Replace the partial index `WHERE status_fk IN (1, 5)` with a non-partial index.
-- The cron query supplies status codes at runtime via a subquery; no ID hardcoding needed.

DROP INDEX IF EXISTS notifications_retry_idx;

CREATE INDEX IF NOT EXISTS notifications_retry_idx
  ON notifications (status_fk, retry_count);

-- ─── 2. Routes parent FK index ────────────────────────────────────────────────
-- Enables efficient child-of-parent lookups in recursive route tree queries.

CREATE INDEX IF NOT EXISTS routes_parent_route_fk_idx
  ON routes (parent_route_fk)
  WHERE parent_route_fk IS NOT NULL;

-- ─── 3. address_type.is_shipping_applicable NOT NULL ──────────────────────────
-- Backfill any existing NULLs to true (the intended default) before applying the constraint.

UPDATE address_type SET is_shipping_applicable = true WHERE is_shipping_applicable IS NULL;
ALTER TABLE address_type ALTER COLUMN is_shipping_applicable SET NOT NULL;

-- ─── 4. lookup_type boolean columns NOT NULL ──────────────────────────────────
-- lookup_type is static system config seeded by migrations. All three boolean
-- columns should be NOT NULL — backfill NULLs to their defaults first.

UPDATE lookup_type SET has_table     = false WHERE has_table     IS NULL;
UPDATE lookup_type SET is_active     = true  WHERE is_active     IS NULL;
UPDATE lookup_type SET is_custom_table = false WHERE is_custom_table IS NULL;

ALTER TABLE lookup_type ALTER COLUMN has_table      SET NOT NULL;
ALTER TABLE lookup_type ALTER COLUMN is_active      SET NOT NULL;
ALTER TABLE lookup_type ALTER COLUMN is_custom_table SET NOT NULL;
