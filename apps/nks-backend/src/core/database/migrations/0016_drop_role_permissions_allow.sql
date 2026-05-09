-- Drop the unused `allow` column from role_permissions.
--
-- Background: the column was written (derived as `!deny`) but never read by
-- the merge logic in PermissionsRepository.mergePermissions. The four
-- `can_view/can_create/can_edit/can_delete` flags + `deny` are sufficient.
-- Keeping a written-but-never-read column is a footgun: a future change that
-- starts reading it would silently grant access nobody intended.
--
-- The `role_route_mapping.allow` column is a separate concern (route-level
-- access) and is read by the route-permission queries — it stays.

ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_no_allow_deny_conflict";
ALTER TABLE "role_permissions" DROP COLUMN IF EXISTS "allow";
