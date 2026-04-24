-- ─── Migration 033: Drop legacy RBAC table ───────────────────────────────────
--
-- Removes `role_entity_permission` (fixed boolean columns per entity) now that
-- the `role_permissions` table (row-per-action) is the sole permission store.
--
-- Prerequisites before running:
--   1. Migration 032 has been applied (role_permissions created + backfilled).
--   2. All application pods are running code that reads/writes ONLY from
--      role_permissions (i.e. this migration ships alongside the code cutover).
--
-- Safe to run with CONCURRENTLY index drops — no table lock held for long.

DROP TABLE IF EXISTS role_entity_permission CASCADE;
