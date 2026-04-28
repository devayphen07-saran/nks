-- Replaces store.store_status enum column with store.status_fk → status.id.
-- Motivation: store lifecycle states (DRAFT, ACTIVE, SUSPENDED, VERIFIED, ARCHIVED, CLOSED)
-- are now rows in the status reference table — extensible without schema migration.
-- isActive sync is now the application layer's responsibility (was a CHECK constraint).

-- 1. Add nullable status_fk for backfill
ALTER TABLE "store" ADD COLUMN "status_fk" BIGINT;--> statement-breakpoint

-- 2. Backfill: map existing enum values to status table rows
UPDATE "store" SET "status_fk" = (SELECT id FROM "status" WHERE code = 'ACTIVE'    AND deleted_at IS NULL LIMIT 1) WHERE store_status = 'ACTIVE';--> statement-breakpoint
UPDATE "store" SET "status_fk" = (SELECT id FROM "status" WHERE code = 'SUSPENDED' AND deleted_at IS NULL LIMIT 1) WHERE store_status = 'SUSPENDED';--> statement-breakpoint
UPDATE "store" SET "status_fk" = (SELECT id FROM "status" WHERE code = 'CLOSED'    AND deleted_at IS NULL LIMIT 1) WHERE store_status = 'CLOSED';--> statement-breakpoint

-- 3. Make NOT NULL and add FK constraint
ALTER TABLE "store" ALTER COLUMN "status_fk" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_status_fk_fkey" FOREIGN KEY ("status_fk") REFERENCES "status"("id") ON DELETE RESTRICT;--> statement-breakpoint

-- 4. Add index
CREATE INDEX "store_status_fk_idx" ON "store" ("status_fk");--> statement-breakpoint

-- 5. Drop old check constraint and column
ALTER TABLE "store" DROP CONSTRAINT IF EXISTS "store_status_active_sync_chk";--> statement-breakpoint
ALTER TABLE "store" DROP COLUMN "store_status";--> statement-breakpoint

-- 6. Drop enum type
DROP TYPE IF EXISTS "store_status";
