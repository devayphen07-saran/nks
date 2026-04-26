-- ─── Migration 053: role_route_mapping CHECK + audit_logs composite index ─────

-- MI-05a: CRUD flags are meaningless when allow=false.
-- Prevents rows where allow=false but canView/canCreate/... are still true,
-- which would make the permission state incoherent.
--
-- Pre-flight: zero out CRUD flags on any existing allow=false rows.
UPDATE role_route_mapping
  SET can_view   = false,
      can_create = false,
      can_edit   = false,
      can_delete = false,
      can_export = false
  WHERE allow = false
    AND (can_view = true OR can_create = true OR can_edit = true
         OR can_delete = true OR can_export = true);

ALTER TABLE role_route_mapping
  ADD CONSTRAINT role_route_mapping_crud_requires_allow
  CHECK (
    allow = true OR (
      can_view   = false AND
      can_create = false AND
      can_edit   = false AND
      can_delete = false AND
      can_export = false
    )
  );

-- MI-05b: composite index for user activity timeline queries.
-- Supports: WHERE user_fk = ? ORDER BY created_at DESC (admin audit log view).
CREATE INDEX audit_logs_user_created_at_idx ON audit_logs (user_fk, created_at);
