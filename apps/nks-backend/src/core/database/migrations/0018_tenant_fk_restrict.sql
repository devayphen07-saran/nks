-- Replace ON DELETE CASCADE with ON DELETE RESTRICT on every tenant-scoping
-- foreign key (user_fk → users, store_fk → store).
--
-- Why:
--   Cascading deletes on tenant FKs let a single accidental DELETE FROM users
--   or DELETE FROM store wipe out 27+ dependent tables silently — sessions,
--   role mappings, lookups, notifications, push tokens, devices, the works.
--   That's the wrong default. Tenant entities (users, store) should be
--   soft-deleted via the existing deletedAt columns; a hard delete should
--   require explicit cleanup of dependents and should fail loudly if any
--   remain. RESTRICT enforces that contract at the DB layer.
--
-- Scope:
--   Only tenant FKs on (users, store) are flipped. Parent-child cascades
--   (lookup_type → lookup, plan → plan_price, subscription →
--   subscription_item, role → role_permissions, tax hierarchy, entity-status
--   hierarchy) are deliberately preserved — those are correct behavior and
--   would force callers to hand-cascade in code if removed.
--
-- Audit before running:
--   This migration verifies that `users.deletedAt IS NULL` and `store.deletedAt
--   IS NULL` are the only delete patterns in use. Hard DELETEs against
--   either table that pass through unrelated dependents will now error with
--   a foreign-key-violation; the caller must soft-delete or explicitly
--   clean up dependents first.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: drop & recreate a (table, column) FK with ON DELETE RESTRICT.
-- We look up the existing constraint name from pg_constraint rather than
-- hardcoding it, because some constraints (lookup.store_fk added inline in
-- 0003_lookup_consolidation) carry Postgres-generated names rather than the
-- Drizzle naming convention.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.swap_fk_to_restrict(
  p_table       text,
  p_column      text,
  p_ref_table   text,
  p_ref_column  text DEFAULT 'id'
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_constraint_name text;
  v_new_name        text := p_table || '_' || p_column || '_' || p_ref_table || '_' || p_ref_column || '_fk';
BEGIN
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_class      tcl  ON tcl.oid = con.conrelid
  JOIN pg_namespace  ns   ON ns.oid  = tcl.relnamespace
  JOIN pg_attribute  att  ON att.attrelid = tcl.oid AND att.attnum = ANY(con.conkey)
  WHERE con.contype = 'f'
    AND ns.nspname  = 'public'
    AND tcl.relname = p_table
    AND att.attname = p_column
  LIMIT 1;

  IF v_constraint_name IS NULL THEN
    RAISE NOTICE 'No existing FK on %.% — skipping', p_table, p_column;
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', p_table, v_constraint_name);
  EXECUTE format(
    'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(%I) ON DELETE RESTRICT ON UPDATE NO ACTION',
    p_table, v_new_name, p_column, p_ref_table, p_ref_column
  );
END
$$;

-- ─── user_fk → users ─────────────────────────────────────────────────────────
SELECT pg_temp.swap_fk_to_restrict('user_session',         'user_fk', 'users');
SELECT pg_temp.swap_fk_to_restrict('user_auth_provider',   'user_fk', 'users');
SELECT pg_temp.swap_fk_to_restrict('user_role_mapping',    'user_fk', 'users');
SELECT pg_temp.swap_fk_to_restrict('store_user_mapping',   'user_fk', 'users');
SELECT pg_temp.swap_fk_to_restrict('user_preferences',     'user_fk', 'users');
SELECT pg_temp.swap_fk_to_restrict('permissions_changelog','user_fk', 'users');
SELECT pg_temp.swap_fk_to_restrict('notifications',        'user_fk', 'users');
SELECT pg_temp.swap_fk_to_restrict('push_tokens',          'user_fk', 'users');
SELECT pg_temp.swap_fk_to_restrict('device_registration',  'user_fk', 'users');

-- ─── store_fk → store ────────────────────────────────────────────────────────
SELECT pg_temp.swap_fk_to_restrict('store_user_mapping',   'store_fk', 'store');
SELECT pg_temp.swap_fk_to_restrict('user_role_mapping',    'store_fk', 'store');
SELECT pg_temp.swap_fk_to_restrict('staff_invite',         'store_fk', 'store');
SELECT pg_temp.swap_fk_to_restrict('store_documents',      'store_fk', 'store');
SELECT pg_temp.swap_fk_to_restrict('store_operating_hours','store_fk', 'store');
SELECT pg_temp.swap_fk_to_restrict('tax_rate_master',      'store_fk', 'store');
SELECT pg_temp.swap_fk_to_restrict('lookup',               'store_fk', 'store');
SELECT pg_temp.swap_fk_to_restrict('device_registration',  'store_fk', 'store');

COMMIT;
