-- Move default store tracking from users.default_store_fk to store.is_default
-- Partial unique index enforces at most one default per owner

-- 1. Add is_default column to store
ALTER TABLE "store" ADD COLUMN "is_default" boolean NOT NULL DEFAULT false;

-- 2. Migrate existing default store data from users → store
UPDATE "store" s
SET is_default = true
FROM "users" u
WHERE u.default_store_fk = s.id;

-- 3. Drop default_store_fk from users
DROP INDEX IF EXISTS "users_default_store_idx";
ALTER TABLE "users" DROP COLUMN IF EXISTS "default_store_fk";

-- 4. Partial unique index: at most one default store per owner
CREATE UNIQUE INDEX "store_owner_default_uidx" ON "store" ("owner_user_fk") WHERE (is_default = true);
