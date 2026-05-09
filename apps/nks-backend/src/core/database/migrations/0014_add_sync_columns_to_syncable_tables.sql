-- Add sync columns (version, created_by_device) to all syncable tables
-- that spread syncColumns() in their Drizzle schema but were missing
-- these columns in the applied migrations.

-- lookup
ALTER TABLE "lookup"
  ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;
ALTER TABLE "lookup"
  ADD COLUMN IF NOT EXISTS "created_by_device" text;

-- lookup_type (also uses syncColumns)
ALTER TABLE "lookup_type"
  ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;
ALTER TABLE "lookup_type"
  ADD COLUMN IF NOT EXISTS "created_by_device" text;
