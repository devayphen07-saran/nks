-- ─── Issue 2: revokedReason ────────────────────────────────────────────────
-- Tracks why a refresh token was revoked:
--   ROTATION | TOKEN_REUSE | LOGOUT | PASSWORD_CHANGE | ADMIN_FORCE_LOGOUT
ALTER TABLE user_session ADD COLUMN IF NOT EXISTS revoked_reason varchar(50);

-- ─── Issue 3: DB-level SUPER_ADMIN singleton constraint ────────────────────
-- Prevents two users from holding the SUPER_ADMIN role simultaneously.
-- PostgreSQL partial index WHERE clause cannot use subqueries, so we resolve
-- the role ID dynamically via a DO block.
-- NOTE: Run this migration AFTER the roles seed has been executed.
DO $$
DECLARE
  super_admin_role_id bigint;
BEGIN
  SELECT id INTO super_admin_role_id
  FROM roles
  WHERE code = 'SUPER_ADMIN' AND store_fk IS NULL
  LIMIT 1;

  IF super_admin_role_id IS NOT NULL THEN
    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS urm_one_super_admin_idx
       ON user_role_mapping(role_fk)
       WHERE role_fk = %s AND deleted_at IS NULL AND is_active = true',
      super_admin_role_id
    );
  END IF;
END $$;
