-- ─── Migration 034: Seed SUPER_ADMIN permissions ─────────────────────────────
--
-- Inserts one row per (SUPER_ADMIN role × entity_type × permission_action) into
-- role_permissions with allowed = true, deny = false.
--
-- Effect: PermissionEvaluatorService no longer needs a hardcoded bypass — when
-- the evaluator queries role_permissions for the SUPER_ADMIN role ID it gets
-- allowed = true for every entity/action combination, which evaluates naturally.
--
-- When a new entity_type or permission_action row is inserted in the future this
-- migration must be re-run (or a follow-up migration added) to keep the SUPER_ADMIN
-- grant complete. This is enforced by the ON CONFLICT DO UPDATE clause — running
-- the migration again is idempotent.
--

INSERT INTO role_permissions (
  guuid,
  role_fk,
  entity_type_fk,
  action_fk,
  allowed,
  deny,
  is_active
)
SELECT
  gen_random_uuid()  AS guuid,
  r.id               AS role_fk,
  et.id              AS entity_type_fk,
  pa.id              AS action_fk,
  true               AS allowed,
  false              AS deny,
  true               AS is_active
FROM roles r
CROSS JOIN entity_type et
CROSS JOIN permission_action pa
WHERE r.code      = 'SUPER_ADMIN'
  AND r.store_fk  IS NULL
  AND r.deleted_at IS NULL
  AND et.deleted_at IS NULL
  AND et.is_active  = true
  AND pa.deleted_at IS NULL
  AND pa.is_active  = true
ON CONFLICT (role_fk, entity_type_fk, action_fk)
DO UPDATE SET
  allowed   = true,
  deny      = false,
  is_active = true;
