-- 030_platform_rbac_scope.sql
--
-- Add scope to entity_type and an is_super_admin flag on roles so that admin
-- surfaces can be evaluated through RBACGuard + @RequireEntityPermission
-- instead of hardcoded @Roles('SUPER_ADMIN'). Replaces the coarse role-code
-- check with data-driven entity permissions.
--
-- After this migration:
--   - entity_type.scope = 'PLATFORM' | 'STORE'
--     PLATFORM entities are evaluated against the user's platform roles
--     (roles with storeFk IS NULL); STORE entities continue to be evaluated
--     against store-scoped roles matching user.activeStoreId.
--   - roles.is_super_admin replaces string comparison against 'SUPER_ADMIN'.
--     Guards read the flag; the role name never touches code paths.
--
-- ENTITY_STATUS is added as a new entity code covering
-- AdminEntityStatusController's assign/remove-status endpoints.

BEGIN;

-- 1. entity_type.scope
ALTER TABLE entity_type
  ADD COLUMN scope varchar(16) NOT NULL DEFAULT 'STORE';

UPDATE entity_type
SET scope = 'PLATFORM'
WHERE code IN (
  'AUDIT_LOG',
  'USER',
  'CODE_CATEGORY',
  'CODE_VALUE',
  'STATUS',
  'LOOKUP',
  'ROUTE'
);

-- 2. New entity code for entity-status assignment (admin surface)
INSERT INTO entity_type (code, label, description, scope, is_active)
VALUES (
  'ENTITY_STATUS',
  'Entity Status Assignment',
  'Mapping between domain entities and allowed statuses',
  'PLATFORM',
  true
)
ON CONFLICT (code) DO UPDATE SET scope = 'PLATFORM';

-- 3. roles.is_super_admin
ALTER TABLE roles
  ADD COLUMN is_super_admin boolean NOT NULL DEFAULT false;

UPDATE roles
SET is_super_admin = true
WHERE code = 'SUPER_ADMIN' AND store_fk IS NULL;

CREATE INDEX idx_roles_is_super_admin
  ON roles (is_super_admin)
  WHERE is_super_admin = true;

-- 4. Seed SUPER_ADMIN permissions on the new ENTITY_STATUS code
--    (all other platform entities are already covered by role-entity-permission-admin.seed.ts)
INSERT INTO role_entity_permission (role_fk, entity_type_fk, can_view, can_create, can_edit, can_delete, is_active)
SELECT
  r.id,
  et.id,
  true, true, true, true, true
FROM roles r
CROSS JOIN entity_type et
WHERE r.code = 'SUPER_ADMIN'
  AND r.store_fk IS NULL
  AND et.code = 'ENTITY_STATUS'
ON CONFLICT (role_fk, entity_type_fk) DO NOTHING;

COMMIT;
