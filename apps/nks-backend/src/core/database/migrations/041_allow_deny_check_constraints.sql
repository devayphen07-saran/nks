-- ─── Migration 041: role_route_mapping + role_permissions — allow/deny CHECK ──
--
-- Problem: both tables have an `allow` (or `allowed`) column and a `deny` column.
-- A row where both are true is logically invalid (grant AND block simultaneously).
-- PostgreSQL would silently accept such a row; the evaluator behaviour is undefined.
--
-- Fix: add CHECK constraints that reject any row with both flags set to true.

ALTER TABLE role_route_mapping
  ADD CONSTRAINT role_route_mapping_no_allow_deny_conflict
  CHECK (NOT (allow = true AND deny = true));

ALTER TABLE role_permissions
  ADD CONSTRAINT role_permissions_no_allow_deny_conflict
  CHECK (NOT (allowed = true AND deny = true));
