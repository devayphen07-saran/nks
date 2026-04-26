-- ─── Migration 051: routes — CHECK deleted rows must have enable = false ──────
--
-- The routes table has two lifecycle mechanisms: deleted_at (soft-delete) and
-- enable (admin toggle). Without a constraint, a row could have
-- deleted_at IS NOT NULL AND enable = true, leaking deleted routes into
-- navigation queries that filter only on enable = true.
--
-- Pre-flight: disable any currently-violating rows before adding the constraint.

UPDATE routes
  SET enable = false
  WHERE deleted_at IS NOT NULL AND enable = true;

ALTER TABLE routes
  ADD CONSTRAINT routes_deleted_must_be_disabled
  CHECK (NOT (deleted_at IS NOT NULL AND enable = true));
