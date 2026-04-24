-- 029_iam_user_id_not_null.sql
--
-- Tighten users.iam_user_id to NOT NULL.
--
-- Motivation
-- ----------
-- `iamUserId` is the primary external user identifier consumed by the ayphen
-- frontend, ayphen-next, and ayphen-iam libs. Those clients treat it as a
-- required field (auth-types.ts) and interpolate it directly into REST paths
-- such as `/v1/users/:iamUserId/companies/owner`. A NULL on the NKS side
-- therefore becomes an unroutable URL on the client side.
--
-- Plan
-- ----
-- 1. Backfill any existing rows where iam_user_id IS NULL with a UUID v4.
--    gen_random_uuid() is available via the pgcrypto extension on recent
--    PostgreSQL versions. If pgcrypto is not already enabled, add:
--       CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- 2. ALTER the column to SET NOT NULL. The existing unique index on
--    iam_user_id is preserved untouched.
--
-- The existing unique index (users_iam_user_id_idx) is unaffected.

BEGIN;

-- 1. Backfill NULLs with fresh UUIDs so SET NOT NULL can succeed.
UPDATE users
SET iam_user_id = gen_random_uuid()::text
WHERE iam_user_id IS NULL;

-- 2. Enforce non-nullability going forward.
ALTER TABLE users
  ALTER COLUMN iam_user_id SET NOT NULL;

COMMIT;
