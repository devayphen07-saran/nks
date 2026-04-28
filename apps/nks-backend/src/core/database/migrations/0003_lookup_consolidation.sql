-- Lookup Consolidation Migration
--
-- Summary of changes:
--   1. Align lookup_type table with current TypeScript schema (add baseEntity columns, widen varchars, fix unique)
--   2. Align lookup table (rename title→label, widen varchars, add store_fk, fix unique indexes)
--   3. Seed 18 lookup_type rows
--   4. Backfill lookup rows from 8 dedicated tables (salutation_type, contact_person_type,
--      notes_type, plan_type, store_category, store_legal_type, tax_line_status, tax_registration_type)
--   5. Re-point FK columns on child tables from old dedicated tables → lookup
--   6. Drop old FK constraints; add new ones referencing lookup
--   7. Drop 8 old dedicated tables + code_category + code_value
--
-- Tables with hasTable=true (dedicated tables that STAY unchanged):
--   address_type, billing_frequency, communication_type, currency, designation_type,
--   entity_type, notification_status, staff_invite_status, tax_filing_frequency, volumes

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE A: Align lookup_type schema
-- ─────────────────────────────────────────────────────────────────────────────

-- Add missing baseEntity columns
ALTER TABLE "lookup_type"
  ADD COLUMN IF NOT EXISTS "guuid"      uuid         NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS "sort_order" integer,
  ADD COLUMN IF NOT EXISTS "is_hidden"  boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "is_system"  boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "created_at" timestamptz  NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "updated_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "created_by" bigint       REFERENCES "users"("id") ON DELETE restrict,
  ADD COLUMN IF NOT EXISTS "modified_by" bigint      REFERENCES "users"("id") ON DELETE restrict,
  ADD COLUMN IF NOT EXISTS "deleted_by" bigint       REFERENCES "users"("id") ON DELETE restrict;--> statement-breakpoint

-- Widen varchar columns to match TypeScript schema
ALTER TABLE "lookup_type"
  ALTER COLUMN "code"        TYPE varchar(50)  USING code::varchar(50),
  ALTER COLUMN "title"       TYPE varchar(100) USING title::varchar(100),
  ALTER COLUMN "description" TYPE varchar(255) USING description::varchar(255);--> statement-breakpoint

-- Add UNIQUE on guuid
ALTER TABLE "lookup_type"
  ADD CONSTRAINT "lookup_type_guuid_unique" UNIQUE ("guuid");--> statement-breakpoint

-- Replace global UNIQUE("code") with partial unique index (allows soft-delete + re-create)
ALTER TABLE "lookup_type"
  DROP CONSTRAINT IF EXISTS "lookup_type_code_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "lookup_type_code_idx"
  ON "lookup_type" ("code")
  WHERE deleted_at IS NULL;--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE B: Align lookup schema
-- ─────────────────────────────────────────────────────────────────────────────

-- Rename title → label
ALTER TABLE "lookup"
  RENAME COLUMN "title" TO "label";--> statement-breakpoint

-- Widen varchar columns
ALTER TABLE "lookup"
  ALTER COLUMN "code"        TYPE varchar(50)  USING code::varchar(50),
  ALTER COLUMN "label"       TYPE varchar(150) USING label::varchar(150),
  ALTER COLUMN "description" TYPE varchar(255) USING description::varchar(255);--> statement-breakpoint

-- Add store_fk column
ALTER TABLE "lookup"
  ADD COLUMN IF NOT EXISTS "store_fk" bigint REFERENCES "store"("id") ON DELETE cascade;--> statement-breakpoint

-- Replace global UNIQUE("code") with composite partial unique indexes
ALTER TABLE "lookup"
  DROP CONSTRAINT IF EXISTS "lookup_code_unique";--> statement-breakpoint

CREATE UNIQUE INDEX "lookup_code_type_global_idx"
  ON "lookup" ("code", "lookup_type_fk")
  WHERE deleted_at IS NULL AND store_fk IS NULL;--> statement-breakpoint

CREATE UNIQUE INDEX "lookup_code_type_store_idx"
  ON "lookup" ("code", "lookup_type_fk", "store_fk")
  WHERE deleted_at IS NULL AND store_fk IS NOT NULL;--> statement-breakpoint

CREATE INDEX "lookup_store_fk_idx"
  ON "lookup" ("store_fk");--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE C: Seed lookup_type rows
-- ─────────────────────────────────────────────────────────────────────────────
-- Insert all 18 lookup types.
-- hasTable=false  → values live in lookup table (these 8 are being migrated now)
-- hasTable=true   → values live in their own dedicated table

INSERT INTO "lookup_type" ("guuid", "code", "title", "has_table", "is_system", "created_at")
VALUES
  -- hasTable=false types (values → lookup table)
  (gen_random_uuid(), 'SALUTATION',             'Salutation',             false, true, now()),
  (gen_random_uuid(), 'CONTACT_PERSON_TYPE',    'Contact Person Type',    false, true, now()),
  (gen_random_uuid(), 'NOTES_TYPE',             'Notes Type',             false, true, now()),
  (gen_random_uuid(), 'PLAN_TYPE',              'Plan Type',              false, true, now()),
  (gen_random_uuid(), 'STORE_CATEGORY',         'Store Category',         false, true, now()),
  (gen_random_uuid(), 'STORE_LEGAL_TYPE',       'Store Legal Type',       false, true, now()),
  (gen_random_uuid(), 'TAX_LINE_STATUS',        'Tax Line Status',        false, true, now()),
  (gen_random_uuid(), 'TAX_REGISTRATION_TYPE',  'Tax Registration Type',  false, true, now()),
  -- hasTable=true types (dedicated tables — registry only, no rows in lookup)
  (gen_random_uuid(), 'ADDRESS_TYPE',           'Address Type',           true,  true, now()),
  (gen_random_uuid(), 'BILLING_FREQUENCY',      'Billing Frequency',      true,  true, now()),
  (gen_random_uuid(), 'COMMUNICATION_TYPE',     'Communication Type',     true,  true, now()),
  (gen_random_uuid(), 'CURRENCY',               'Currency',               true,  true, now()),
  (gen_random_uuid(), 'DESIGNATION_TYPE',       'Designation Type',       true,  true, now()),
  (gen_random_uuid(), 'ENTITY_TYPE',            'Entity Type',            true,  true, now()),
  (gen_random_uuid(), 'NOTIFICATION_STATUS',    'Notification Status',    true,  true, now()),
  (gen_random_uuid(), 'STAFF_INVITE_STATUS',    'Staff Invite Status',    true,  true, now()),
  (gen_random_uuid(), 'TAX_FILING_FREQUENCY',   'Tax Filing Frequency',   true,  true, now()),
  (gen_random_uuid(), 'VOLUMES',                'Volumes',                true,  true, now())
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE D: Backfill lookup rows from 8 old dedicated tables
-- ─────────────────────────────────────────────────────────────────────────────

-- SALUTATION
INSERT INTO "lookup" (guuid, is_active, created_at, updated_at, deleted_at, sort_order, is_hidden, is_system, lookup_type_fk, code, label, description, created_by, modified_by, deleted_by)
SELECT
  t.guuid, t.is_active, t.created_at, t.updated_at, t.deleted_at, t.sort_order, t.is_hidden, t.is_system,
  (SELECT id FROM lookup_type WHERE code = 'SALUTATION' AND deleted_at IS NULL LIMIT 1),
  t.code, t.label, t.description, t.created_by, t.modified_by, t.deleted_by
FROM salutation_type t
ON CONFLICT (guuid) DO NOTHING;--> statement-breakpoint

-- CONTACT_PERSON_TYPE
INSERT INTO "lookup" (guuid, is_active, created_at, updated_at, deleted_at, sort_order, is_hidden, is_system, lookup_type_fk, code, label, description, created_by, modified_by, deleted_by)
SELECT
  t.guuid, t.is_active, t.created_at, t.updated_at, t.deleted_at, t.sort_order, t.is_hidden, t.is_system,
  (SELECT id FROM lookup_type WHERE code = 'CONTACT_PERSON_TYPE' AND deleted_at IS NULL LIMIT 1),
  t.code, t.label, t.description, t.created_by, t.modified_by, t.deleted_by
FROM contact_person_type t
ON CONFLICT (guuid) DO NOTHING;--> statement-breakpoint

-- NOTES_TYPE (non-standard column names: notes_type_code, notes_type_name)
INSERT INTO "lookup" (guuid, is_active, created_at, updated_at, deleted_at, sort_order, is_hidden, is_system, lookup_type_fk, code, label, description, created_by, modified_by, deleted_by)
SELECT
  t.guuid, t.is_active, t.created_at, t.updated_at, t.deleted_at, t.sort_order, t.is_hidden, t.is_system,
  (SELECT id FROM lookup_type WHERE code = 'NOTES_TYPE' AND deleted_at IS NULL LIMIT 1),
  t.notes_type_code, t.notes_type_name, t.description, t.created_by, t.modified_by, t.deleted_by
FROM notes_type t
ON CONFLICT (guuid) DO NOTHING;--> statement-breakpoint

-- PLAN_TYPE
INSERT INTO "lookup" (guuid, is_active, created_at, updated_at, deleted_at, sort_order, is_hidden, is_system, lookup_type_fk, code, label, description, created_by, modified_by, deleted_by)
SELECT
  t.guuid, t.is_active, t.created_at, t.updated_at, t.deleted_at, t.sort_order, t.is_hidden, t.is_system,
  (SELECT id FROM lookup_type WHERE code = 'PLAN_TYPE' AND deleted_at IS NULL LIMIT 1),
  t.code, t.label, t.description, t.created_by, t.modified_by, t.deleted_by
FROM plan_type t
ON CONFLICT (guuid) DO NOTHING;--> statement-breakpoint

-- STORE_CATEGORY
INSERT INTO "lookup" (guuid, is_active, created_at, updated_at, deleted_at, sort_order, is_hidden, is_system, lookup_type_fk, code, label, description, created_by, modified_by, deleted_by)
SELECT
  t.guuid, t.is_active, t.created_at, t.updated_at, t.deleted_at, t.sort_order, t.is_hidden, t.is_system,
  (SELECT id FROM lookup_type WHERE code = 'STORE_CATEGORY' AND deleted_at IS NULL LIMIT 1),
  t.code, t.label, t.description, t.created_by, t.modified_by, t.deleted_by
FROM store_category t
ON CONFLICT (guuid) DO NOTHING;--> statement-breakpoint

-- STORE_LEGAL_TYPE
INSERT INTO "lookup" (guuid, is_active, created_at, updated_at, deleted_at, sort_order, is_hidden, is_system, lookup_type_fk, code, label, description, created_by, modified_by, deleted_by)
SELECT
  t.guuid, t.is_active, t.created_at, t.updated_at, t.deleted_at, t.sort_order, t.is_hidden, t.is_system,
  (SELECT id FROM lookup_type WHERE code = 'STORE_LEGAL_TYPE' AND deleted_at IS NULL LIMIT 1),
  t.code, t.label, t.description, t.created_by, t.modified_by, t.deleted_by
FROM store_legal_type t
ON CONFLICT (guuid) DO NOTHING;--> statement-breakpoint

-- TAX_LINE_STATUS
INSERT INTO "lookup" (guuid, is_active, created_at, updated_at, deleted_at, sort_order, is_hidden, is_system, lookup_type_fk, code, label, description, created_by, modified_by, deleted_by)
SELECT
  t.guuid, t.is_active, t.created_at, t.updated_at, t.deleted_at, t.sort_order, t.is_hidden, t.is_system,
  (SELECT id FROM lookup_type WHERE code = 'TAX_LINE_STATUS' AND deleted_at IS NULL LIMIT 1),
  t.code, t.label, t.description, t.created_by, t.modified_by, t.deleted_by
FROM tax_line_status t
ON CONFLICT (guuid) DO NOTHING;--> statement-breakpoint

-- TAX_REGISTRATION_TYPE
INSERT INTO "lookup" (guuid, is_active, created_at, updated_at, deleted_at, sort_order, is_hidden, is_system, lookup_type_fk, code, label, description, created_by, modified_by, deleted_by)
SELECT
  t.guuid, t.is_active, t.created_at, t.updated_at, t.deleted_at, t.sort_order, t.is_hidden, t.is_system,
  (SELECT id FROM lookup_type WHERE code = 'TAX_REGISTRATION_TYPE' AND deleted_at IS NULL LIMIT 1),
  t.code, t.label, t.description, t.created_by, t.modified_by, t.deleted_by
FROM tax_registration_type t
ON CONFLICT (guuid) DO NOTHING;--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE E: Re-point FK columns from old dedicated tables → lookup
-- ─────────────────────────────────────────────────────────────────────────────
-- Strategy: join on guuid to find the new lookup.id for each old row.

-- store.store_legal_type_fk
UPDATE "store" s
SET store_legal_type_fk = l.id
FROM "lookup" l
JOIN "lookup_type" lt ON lt.id = l.lookup_type_fk AND lt.code = 'STORE_LEGAL_TYPE'
JOIN "store_legal_type" slt ON slt.guuid = l.guuid
WHERE s.store_legal_type_fk = slt.id;--> statement-breakpoint

-- store.store_category_fk
UPDATE "store" s
SET store_category_fk = l.id
FROM "lookup" l
JOIN "lookup_type" lt ON lt.id = l.lookup_type_fk AND lt.code = 'STORE_CATEGORY'
JOIN "store_category" sc ON sc.guuid = l.guuid
WHERE s.store_category_fk = sc.id;--> statement-breakpoint

-- contact_person.contact_person_type_fk
UPDATE "contact_person" cp
SET contact_person_type_fk = l.id
FROM "lookup" l
JOIN "lookup_type" lt ON lt.id = l.lookup_type_fk AND lt.code = 'CONTACT_PERSON_TYPE'
JOIN "contact_person_type" cpt ON cpt.guuid = l.guuid
WHERE cp.contact_person_type_fk = cpt.id;--> statement-breakpoint

-- contact_person.salutation_fk (nullable)
UPDATE "contact_person" cp
SET salutation_fk = l.id
FROM "lookup" l
JOIN "lookup_type" lt ON lt.id = l.lookup_type_fk AND lt.code = 'SALUTATION'
JOIN "salutation_type" st ON st.guuid = l.guuid
WHERE cp.salutation_fk = st.id;--> statement-breakpoint

-- notes.notes_type_fk
UPDATE "notes" n
SET notes_type_fk = l.id
FROM "lookup" l
JOIN "lookup_type" lt ON lt.id = l.lookup_type_fk AND lt.code = 'NOTES_TYPE'
JOIN "notes_type" nt ON nt.guuid = l.guuid
WHERE n.notes_type_fk = nt.id;--> statement-breakpoint

-- plans.plan_type_fk
UPDATE "plans" p
SET plan_type_fk = l.id
FROM "lookup" l
JOIN "lookup_type" lt ON lt.id = l.lookup_type_fk AND lt.code = 'PLAN_TYPE'
JOIN "plan_type" pt ON pt.guuid = l.guuid
WHERE p.plan_type_fk = pt.id;--> statement-breakpoint

-- tax_registrations.registration_type_fk
UPDATE "tax_registrations" tr
SET registration_type_fk = l.id
FROM "lookup" l
JOIN "lookup_type" lt ON lt.id = l.lookup_type_fk AND lt.code = 'TAX_REGISTRATION_TYPE'
JOIN "tax_registration_type" trt ON trt.guuid = l.guuid
WHERE tr.registration_type_fk = trt.id;--> statement-breakpoint

-- transaction_tax_lines.approval_status_fk (nullable)
UPDATE "transaction_tax_lines" ttl
SET approval_status_fk = l.id
FROM "lookup" l
JOIN "lookup_type" lt ON lt.id = l.lookup_type_fk AND lt.code = 'TAX_LINE_STATUS'
JOIN "tax_line_status" tls ON tls.guuid = l.guuid
WHERE ttl.approval_status_fk = tls.id;--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE F: Drop old FK constraints; add new ones referencing lookup
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "store"
  DROP CONSTRAINT IF EXISTS "store_store_legal_type_fk_store_legal_type_id_fk",
  DROP CONSTRAINT IF EXISTS "store_store_category_fk_store_category_id_fk",
  ADD CONSTRAINT "store_store_legal_type_fk_lookup_id_fk"
    FOREIGN KEY ("store_legal_type_fk") REFERENCES "lookup"("id") ON DELETE restrict,
  ADD CONSTRAINT "store_store_category_fk_lookup_id_fk"
    FOREIGN KEY ("store_category_fk") REFERENCES "lookup"("id") ON DELETE restrict;--> statement-breakpoint

ALTER TABLE "contact_person"
  DROP CONSTRAINT IF EXISTS "contact_person_contact_person_type_fk_contact_person_type_id_fk",
  DROP CONSTRAINT IF EXISTS "contact_person_salutation_fk_salutation_type_id_fk",
  ADD CONSTRAINT "contact_person_contact_person_type_fk_lookup_id_fk"
    FOREIGN KEY ("contact_person_type_fk") REFERENCES "lookup"("id") ON DELETE restrict,
  ADD CONSTRAINT "contact_person_salutation_fk_lookup_id_fk"
    FOREIGN KEY ("salutation_fk") REFERENCES "lookup"("id") ON DELETE set null;--> statement-breakpoint

ALTER TABLE "notes"
  DROP CONSTRAINT IF EXISTS "notes_notes_type_fk_notes_type_id_fk",
  ADD CONSTRAINT "notes_notes_type_fk_lookup_id_fk"
    FOREIGN KEY ("notes_type_fk") REFERENCES "lookup"("id") ON DELETE restrict;--> statement-breakpoint

ALTER TABLE "plans"
  DROP CONSTRAINT IF EXISTS "plans_plan_type_fk_plan_type_id_fk",
  ADD CONSTRAINT "plans_plan_type_fk_lookup_id_fk"
    FOREIGN KEY ("plan_type_fk") REFERENCES "lookup"("id") ON DELETE restrict;--> statement-breakpoint

ALTER TABLE "tax_registrations"
  DROP CONSTRAINT IF EXISTS "tax_registrations_registration_type_fk_tax_registration_type_id_fk",
  ADD CONSTRAINT "tax_registrations_registration_type_fk_lookup_id_fk"
    FOREIGN KEY ("registration_type_fk") REFERENCES "lookup"("id") ON DELETE restrict;--> statement-breakpoint

ALTER TABLE "transaction_tax_lines"
  DROP CONSTRAINT IF EXISTS "transaction_tax_lines_approval_status_fk_tax_line_status_id_fk",
  ADD CONSTRAINT "transaction_tax_lines_approval_status_fk_lookup_id_fk"
    FOREIGN KEY ("approval_status_fk") REFERENCES "lookup"("id") ON DELETE restrict;--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE G: Drop old dedicated tables and code tables
-- ─────────────────────────────────────────────────────────────────────────────
-- Drop in dependency order (referencing tables before referenced).
-- code_value references code_category, so drop code_value first.

DROP TABLE IF EXISTS "salutation_type";--> statement-breakpoint
DROP TABLE IF EXISTS "contact_person_type";--> statement-breakpoint
DROP TABLE IF EXISTS "notes_type";--> statement-breakpoint
DROP TABLE IF EXISTS "plan_type";--> statement-breakpoint
DROP TABLE IF EXISTS "store_category";--> statement-breakpoint
DROP TABLE IF EXISTS "store_legal_type";--> statement-breakpoint
DROP TABLE IF EXISTS "tax_line_status";--> statement-breakpoint
DROP TABLE IF EXISTS "tax_registration_type";--> statement-breakpoint
DROP TABLE IF EXISTS "code_value";--> statement-breakpoint
DROP TABLE IF EXISTS "code_category";--> statement-breakpoint
