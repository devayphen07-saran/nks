-- ─── Migration 054: guuid — convert all varchar(255) columns to native uuid ───
--
-- All guuid columns are populated by crypto.randomUUID() which always produces
-- valid RFC-4122 UUIDs, so the ::uuid cast is safe on all existing data.
--
-- Using a DO block to avoid repeating ALTER TABLE for each of the ~55 tables.
-- The loop targets only varchar columns named guuid in the public schema so it
-- is idempotent — uuid columns are silently skipped.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'guuid'
      AND data_type   = 'character varying'
      AND table_schema = 'public'
    ORDER BY table_name
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN guuid TYPE uuid USING guuid::uuid',
      r.table_name
    );
  END LOOP;
END $$;
