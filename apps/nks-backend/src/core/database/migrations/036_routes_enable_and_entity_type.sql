-- ─── Migration 036: Routes — enable flag + entity_type_fk backfill ────────────
--
-- 1. Adds an `enable` boolean to routes (DEFAULT true).
--    Distinct from `is_active` (soft-delete): admins can toggle `enable` to
--    hide a route from navigation without it appearing deleted.
--
-- 2. Backfills entity_type_fk on all seeded system routes so that the
--    hasAccess computation in RoutesService has entity bindings to evaluate.
--    Routes with no business entity (Dashboard, Settings, etc.) remain NULL.

-- ─── 1. enable column ─────────────────────────────────────────────────────────

ALTER TABLE routes
  ADD COLUMN IF NOT EXISTS enable BOOLEAN NOT NULL DEFAULT true;

-- ─── 2. Backfill entity_type_fk on seeded store routes ───────────────────────

UPDATE routes SET entity_type_fk = (SELECT id FROM entity_type WHERE code = 'TRANSACTION')
  WHERE route_path = '/pos'             AND route_scope = 'store' AND deleted_at IS NULL;

UPDATE routes SET entity_type_fk = (SELECT id FROM entity_type WHERE code = 'ORDER')
  WHERE route_path = '/orders'          AND route_scope = 'store' AND deleted_at IS NULL;

UPDATE routes SET entity_type_fk = (SELECT id FROM entity_type WHERE code = 'PRODUCT')
  WHERE route_path = '/products'        AND route_scope = 'store' AND deleted_at IS NULL;

UPDATE routes SET entity_type_fk = (SELECT id FROM entity_type WHERE code = 'CUSTOMER')
  WHERE route_path = '/customers'       AND route_scope = 'store' AND deleted_at IS NULL;

UPDATE routes SET entity_type_fk = (SELECT id FROM entity_type WHERE code = 'VENDOR')
  WHERE route_path = '/suppliers'       AND route_scope = 'store' AND deleted_at IS NULL;

UPDATE routes SET entity_type_fk = (SELECT id FROM entity_type WHERE code = 'INVENTORY')
  WHERE route_path = '/inventory'       AND route_scope = 'store' AND deleted_at IS NULL;

UPDATE routes SET entity_type_fk = (SELECT id FROM entity_type WHERE code = 'REPORT')
  WHERE route_path = '/reports'         AND route_scope = 'store' AND deleted_at IS NULL;

UPDATE routes SET entity_type_fk = (SELECT id FROM entity_type WHERE code = 'USER')
  WHERE route_path = '/user-management' AND route_scope = 'store' AND deleted_at IS NULL;

-- ─── 3. Backfill entity_type_fk on seeded admin routes ───────────────────────

UPDATE routes SET entity_type_fk = (SELECT id FROM entity_type WHERE code = 'STORE')
  WHERE route_path = '/admin/stores'               AND route_scope = 'admin' AND deleted_at IS NULL;

UPDATE routes SET entity_type_fk = (SELECT id FROM entity_type WHERE code = 'USER')
  WHERE route_path = '/admin/users'                AND route_scope = 'admin' AND deleted_at IS NULL;

UPDATE routes SET entity_type_fk = (SELECT id FROM entity_type WHERE code = 'BILLING')
  WHERE route_path = '/admin/billing'              AND route_scope = 'admin' AND deleted_at IS NULL;

UPDATE routes SET entity_type_fk = (SELECT id FROM entity_type WHERE code = 'ROLE')
  WHERE route_path = '/admin/roles'                AND route_scope = 'admin' AND deleted_at IS NULL;

UPDATE routes SET entity_type_fk = (SELECT id FROM entity_type WHERE code = 'SUBSCRIPTION')
  WHERE route_path = '/admin/subscriptions'        AND route_scope = 'admin' AND deleted_at IS NULL;

UPDATE routes SET entity_type_fk = (SELECT id FROM entity_type WHERE code = 'LOOKUP')
  WHERE route_path = '/admin/lookup-configuration' AND route_scope = 'admin' AND deleted_at IS NULL;
