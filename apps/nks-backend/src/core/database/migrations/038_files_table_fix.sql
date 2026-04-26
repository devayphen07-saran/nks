-- ─── Migration 038: files — align with coreEntity() standard ─────────────────
--
-- Problem: the files table was hand-rolled and diverged from the coreEntity()
-- base used by every other transactional table:
--   • No guuid          — needed for public URL references
--   • No is_active      — soft-delete uses deletedAt only; is_active is missing
--   • No updated_at     — no mutation timestamp for renames / replacements
--   • is_deleted bool   — redundant with deletedAt; can silently desync
--   • No modified_by    — incomplete audit trail
--   • PK was GENERATED ALWAYS AS IDENTITY; bigserial is equivalent (no change needed)
--
-- Fix: add the missing coreEntity columns, backfill guuid, drop is_deleted.

-- ─── 1. Add missing coreEntity columns ───────────────────────────────────────

ALTER TABLE files
  ADD COLUMN IF NOT EXISTS guuid      varchar(255),
  ADD COLUMN IF NOT EXISTS is_active  boolean      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Backfill guuid for existing rows (gen_random_uuid() produces UUID v4)
UPDATE files SET guuid = gen_random_uuid()::text WHERE guuid IS NULL;

-- Now enforce NOT NULL + UNIQUE
ALTER TABLE files
  ALTER COLUMN guuid SET NOT NULL,
  ADD CONSTRAINT files_guuid_unique UNIQUE (guuid);

-- ─── 2. Add missing audit column ─────────────────────────────────────────────

ALTER TABLE files
  ADD COLUMN IF NOT EXISTS modified_by bigint REFERENCES users(id) ON DELETE RESTRICT;

-- ─── 3. Sync is_active from is_deleted ───────────────────────────────────────
-- Any row already soft-deleted via is_deleted=true should have is_active=false.

UPDATE files SET is_active = false WHERE is_deleted = true;

-- ─── 4. Drop the redundant is_deleted column ─────────────────────────────────

ALTER TABLE files DROP COLUMN IF EXISTS is_deleted;
