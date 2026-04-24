-- Migration 031: Add FK constraint for users.default_store_fk and store performance index
--
-- PREREQUISITES: Verify no orphaned references before running:
--   SELECT u.id, u.default_store_fk
--   FROM users u
--   WHERE u.default_store_fk IS NOT NULL
--     AND NOT EXISTS (SELECT 1 FROM store s WHERE s.id = u.default_store_fk);
--
-- If that query returns rows, clear them first:
--   UPDATE users SET default_store_fk = NULL
--   WHERE default_store_fk IS NOT NULL
--     AND NOT EXISTS (SELECT 1 FROM store s WHERE s.id = default_store_fk);

-- 1. FK: users.default_store_fk → store.id
--    ON DELETE SET NULL: when a store is deleted, the user's preference is cleared.
--    Cannot be declared in Drizzle schema due to users ↔ store circular import.
ALTER TABLE users
  ADD CONSTRAINT users_default_store_fk_fkey
  FOREIGN KEY (default_store_fk) REFERENCES store(id) ON DELETE SET NULL;

-- 2. Partial index on store: accelerates active-store scans used by getStoresForUser
--    and any future queries that filter WHERE is_active = true AND deleted_at IS NULL.
--    PK-based lookups (findActiveById) are unaffected — PK index is still used first.
CREATE INDEX CONCURRENTLY IF NOT EXISTS store_active_deleted_idx
  ON store (is_active, deleted_at)
  WHERE is_active = true AND deleted_at IS NULL;
