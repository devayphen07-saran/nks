-- ─── Migration 032: Dynamic RBAC ─────────────────────────────────────────────
--
-- Adds two new tables to support a row-per-action, database-driven permission
-- model that replaces the fixed boolean columns in role_entity_permission.
--
-- Phase 0 (dual-write shadow): both tables are written on every permission
-- update. The new table is read only when RBAC_USE_NEW_PERMISSIONS=true.
-- See PermissionEvaluatorService for the feature-flag logic.
--
-- Also extends the routes table with an entity_type_fk so route-level
-- permission checks can be driven by the same entity taxonomy.

-- ─── 1. permission_action ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS permission_action (
  id               BIGSERIAL     PRIMARY KEY,
  guuid            UUID          NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  code             VARCHAR(50)   NOT NULL UNIQUE,
  display_name     VARCHAR(100)  NOT NULL,
  description      TEXT,
  is_system        BOOLEAN       NOT NULL DEFAULT false,
  sort_order       INTEGER,
  is_hidden        BOOLEAN       NOT NULL DEFAULT false,
  is_active        BOOLEAN       NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ,
  deleted_at       TIMESTAMPTZ,
  created_by_fk    BIGINT        REFERENCES users(id) ON DELETE SET NULL,
  updated_by_fk    BIGINT        REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS permission_action_active_idx
  ON permission_action (is_active)
  WHERE is_active = true AND deleted_at IS NULL;

-- Seed: system actions (VIEW/CREATE/EDIT/DELETE) + extended actions
INSERT INTO permission_action (code, display_name, description, is_system, sort_order, is_active)
VALUES
  ('VIEW',    'View',    'Permission to view/read a resource',           true,  1, true),
  ('CREATE',  'Create',  'Permission to create a new resource',          true,  2, true),
  ('EDIT',    'Edit',    'Permission to update an existing resource',    true,  3, true),
  ('DELETE',  'Delete',  'Permission to delete a resource',              true,  4, true),
  ('EXPORT',  'Export',  'Permission to export resource data',           false, 5, true),
  ('APPROVE', 'Approve', 'Permission to approve a resource or workflow', false, 6, true),
  ('ARCHIVE', 'Archive', 'Permission to archive a resource',             false, 7, true)
ON CONFLICT (code) DO NOTHING;

-- ─── 2. role_permissions ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS role_permissions (
  id               BIGSERIAL   PRIMARY KEY,
  guuid            UUID        NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  role_fk          BIGINT      NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  entity_type_fk   BIGINT      NOT NULL REFERENCES entity_type(id) ON DELETE RESTRICT,
  action_fk        BIGINT      NOT NULL REFERENCES permission_action(id) ON DELETE RESTRICT,
  allowed          BOOLEAN     NOT NULL DEFAULT false,
  deny             BOOLEAN     NOT NULL DEFAULT false,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ,
  deleted_at       TIMESTAMPTZ,
  CONSTRAINT role_permissions_unique_idx UNIQUE (role_fk, entity_type_fk, action_fk)
);

CREATE INDEX IF NOT EXISTS role_permissions_role_idx
  ON role_permissions (role_fk)
  WHERE is_active = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS role_permissions_role_entity_idx
  ON role_permissions (role_fk, entity_type_fk)
  WHERE is_active = true AND deleted_at IS NULL;

-- ─── 3. Backfill role_permissions from role_entity_permission ─────────────────
--
-- Converts the four fixed boolean columns into rows in the new table.
-- Runs only once; ON CONFLICT DO NOTHING makes it idempotent.

INSERT INTO role_permissions (role_fk, entity_type_fk, action_fk, allowed, deny, is_active)
SELECT
  rep.role_fk,
  rep.entity_type_fk,
  pa.id   AS action_fk,
  CASE pa.code
    WHEN 'VIEW'   THEN rep.can_view
    WHEN 'CREATE' THEN rep.can_create
    WHEN 'EDIT'   THEN rep.can_edit
    WHEN 'DELETE' THEN rep.can_delete
    ELSE false
  END     AS allowed,
  COALESCE(rep.deny, false) AS deny,
  true    AS is_active
FROM role_entity_permission rep
CROSS JOIN permission_action pa
WHERE pa.code IN ('VIEW', 'CREATE', 'EDIT', 'DELETE')
  AND rep.deleted_at IS NULL
ON CONFLICT (role_fk, entity_type_fk, action_fk) DO NOTHING;

-- ─── 4. routes — entity_type_fk + default_action ─────────────────────────────

ALTER TABLE routes
  ADD COLUMN IF NOT EXISTS entity_type_fk BIGINT REFERENCES entity_type(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_action  VARCHAR(50) DEFAULT 'view';

CREATE INDEX IF NOT EXISTS routes_entity_type_idx
  ON routes (entity_type_fk)
  WHERE entity_type_fk IS NOT NULL AND deleted_at IS NULL;
