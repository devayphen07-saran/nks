-- Redesigns role_permissions from per-action rows to one wide row per (role, entity).
-- Old: (role_fk, entity_type_fk, action_fk, allowed)
-- New: (role_fk, entity_type_fk, allow, can_view, can_create, can_edit, can_delete)
--> statement-breakpoint

-- 1. Drop FK and constraints that depend on old columns
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_action_fk_permission_action_id_fk";
--> statement-breakpoint
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_unique_idx";
--> statement-breakpoint
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_no_allow_deny_conflict";
--> statement-breakpoint

-- 2. Drop old column
ALTER TABLE "role_permissions" DROP COLUMN "action_fk";
--> statement-breakpoint

-- 3. Rename allowed → allow
ALTER TABLE "role_permissions" RENAME COLUMN "allowed" TO "allow";
--> statement-breakpoint

-- 4. Add new permission flag columns
ALTER TABLE "role_permissions" ADD COLUMN "can_view" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "role_permissions" ADD COLUMN "can_create" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "role_permissions" ADD COLUMN "can_edit" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "role_permissions" ADD COLUMN "can_delete" boolean DEFAULT false NOT NULL;
--> statement-breakpoint

-- 5. Re-add unique constraint on the new (role, entity) pair
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_unique_idx" UNIQUE("role_fk","entity_type_fk");
--> statement-breakpoint

-- 6. Re-add check constraint using the renamed column
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_no_allow_deny_conflict" CHECK (NOT (allow = true AND deny = true));
--> statement-breakpoint

-- 7. Indexes for guard lookups (partial — only active, non-deleted rows)
CREATE INDEX IF NOT EXISTS "role_permissions_role_idx" ON "role_permissions" ("role_fk") WHERE is_active = true AND deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_role_entity_idx" ON "role_permissions" ("role_fk","entity_type_fk") WHERE is_active = true AND deleted_at IS NULL;
