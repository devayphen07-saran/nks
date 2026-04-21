-- ============================================================
-- Migration 028: Row-Level Security for soft-delete enforcement
-- ============================================================
--
-- PROBLEM:
--   All 60+ tables that spread coreEntity() / baseEntity() carry a
--   deleted_at column for soft deletes.  The only thing preventing
--   deleted rows from leaking into application queries is a WHERE
--   deleted_at IS NULL clause in each repository method.  A single
--   forgotten isNull(deletedAt) silently returns deleted records.
--
-- SOLUTION — three layers:
--   1. An `nks_app` role that is NOT a superuser → RLS is enforced.
--   2. RLS enabled on every table that has deleted_at:
--        FOR SELECT: only rows where deleted_at IS NULL are visible.
--        FOR INSERT / UPDATE / DELETE: unrestricted (soft-delete
--        writes and hard-deletes for junction tables still work).
--   3. The application pool sets `SET ROLE nks_app` on every new
--      connection (see database.module.ts) so the DB enforces RLS
--      even if DATABASE_URL connects as postgres superuser.
--
-- MIGRATION OPERATIONS:
--   Run as postgres superuser (drizzle-kit / admin URL).
--   Application pool connections use nks_app → RLS is enforced.
--   Superuser DBA sessions bypass RLS unless they also SET ROLE.
-- ============================================================

-- ── Step 1: Create the application role ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_catalog.pg_roles WHERE rolname = 'nks_app'
  ) THEN
    CREATE ROLE nks_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

-- Grant DML on all current tables and sequences
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public
  TO nks_app;

GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA public
  TO nks_app;

-- Ensure future tables/sequences created by superuser are accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nks_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO nks_app;

-- ── Step 2: Enable RLS on every table with deleted_at ────────
--
-- Uses a dynamic PL/pgSQL block so that:
--  • New tables added later are handled by re-running this block.
--  • Policies are idempotent (DROP IF EXISTS before CREATE).
--
DO $$
DECLARE
  tbl record;
BEGIN
  FOR tbl IN
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON  c.table_name  = t.table_name
      AND t.table_schema = 'public'
      AND t.table_type   = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.column_name  = 'deleted_at'
    ORDER BY c.table_name
  LOOP
    -- Enable RLS (safe to call even if already enabled)
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl.table_name);

    -- SELECT: nks_app only sees rows where deleted_at IS NULL
    EXECUTE format('DROP POLICY IF EXISTS rls_soft_delete_select ON %I', tbl.table_name);
    EXECUTE format(
      $policy$
        CREATE POLICY rls_soft_delete_select ON %I
          AS PERMISSIVE FOR SELECT TO nks_app
          USING (deleted_at IS NULL)
      $policy$,
      tbl.table_name
    );

    -- INSERT: allow all inserts (new rows always have deleted_at = NULL)
    EXECUTE format('DROP POLICY IF EXISTS rls_allow_insert ON %I', tbl.table_name);
    EXECUTE format(
      $policy$
        CREATE POLICY rls_allow_insert ON %I
          AS PERMISSIVE FOR INSERT TO nks_app
          WITH CHECK (true)
      $policy$,
      tbl.table_name
    );

    -- UPDATE: allow all updates, including setting deleted_at (soft-delete write)
    EXECUTE format('DROP POLICY IF EXISTS rls_allow_update ON %I', tbl.table_name);
    EXECUTE format(
      $policy$
        CREATE POLICY rls_allow_update ON %I
          AS PERMISSIVE FOR UPDATE TO nks_app
          USING (true) WITH CHECK (true)
      $policy$,
      tbl.table_name
    );

    -- DELETE: allow hard deletes (cascade cleanup, junction tables, etc.)
    EXECUTE format('DROP POLICY IF EXISTS rls_allow_delete ON %I', tbl.table_name);
    EXECUTE format(
      $policy$
        CREATE POLICY rls_allow_delete ON %I
          AS PERMISSIVE FOR DELETE TO nks_app
          USING (true)
      $policy$,
      tbl.table_name
    );
  END LOOP;
END $$;

-- ── Step 3: Grant nks_app to the login role used by the pool ─
--
-- Replace 'your_db_login' with the actual login role in DATABASE_URL
-- (e.g. the username in postgresql://username:password@host/db).
-- A superuser can SET ROLE nks_app; a non-superuser needs GRANT.
--
-- Example (run manually or add to your infra bootstrap):
--   GRANT nks_app TO your_db_login;
--
-- The application pool calls `SET ROLE nks_app` on every connection
-- (see database.module.ts pool.on('connect') handler), so even
-- connections made as the postgres superuser will have RLS enforced.
