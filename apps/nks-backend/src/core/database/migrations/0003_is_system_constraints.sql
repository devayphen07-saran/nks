-- Adds DB-level check constraints to prevent soft-deletion of is_system=true rows.
-- Previously enforced only by service-layer validators — this adds a second layer
-- so any code path (sync, admin scripts, future endpoints) that bypasses validators
-- is blocked at the DB level.
--
-- Constraint: if is_system = true, then deleted_at must remain NULL.
-- softDeleteAudited() sets both isActive=false AND deletedAt=new Date() atomically,
-- so blocking deleted_at is sufficient to prevent the full soft-delete operation.

ALTER TABLE "lookup"
  ADD CONSTRAINT "lookup_system_no_delete_chk"
  CHECK (NOT (is_system = true AND deleted_at IS NOT NULL));--> statement-breakpoint

ALTER TABLE "lookup_type"
  ADD CONSTRAINT "lookup_type_system_no_delete_chk"
  CHECK (NOT (is_system = true AND deleted_at IS NOT NULL));--> statement-breakpoint

ALTER TABLE "roles"
  ADD CONSTRAINT "roles_system_no_delete_chk"
  CHECK (NOT (is_system = true AND deleted_at IS NOT NULL));--> statement-breakpoint

ALTER TABLE "status"
  ADD CONSTRAINT "status_system_no_delete_chk"
  CHECK (NOT (is_system = true AND deleted_at IS NOT NULL));--> statement-breakpoint
