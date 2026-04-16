-- Migration 025: Role expiry field in user_role_mapping
-- Adds optional expires_at to support temporary role grants (e.g., trial MANAGER for N days).
-- NULL = assignment never expires. AuthGuard filters rows where expires_at < NOW().

ALTER TABLE user_role_mapping
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS urm_expires_at_idx ON user_role_mapping (expires_at);
