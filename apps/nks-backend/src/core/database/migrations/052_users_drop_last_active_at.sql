-- ─── Migration 052: users — drop last_active_at denormalized column ──────────
--
-- last_active_at was written on every authenticated request (throttled to 5 min)
-- causing constant write pressure on the users table. The authoritative
-- "last seen" value is user_session.updated_at; callers that need last-active
-- should query MAX(updated_at) FROM user_session WHERE user_fk = ? AND deleted_at IS NULL.

ALTER TABLE users DROP COLUMN IF EXISTS last_active_at;
