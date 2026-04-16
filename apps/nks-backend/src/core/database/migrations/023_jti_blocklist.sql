-- Migration 023: JTI Blocklist + jti column on user_session
-- Adds short-lived JWT revocation so tokens are invalid immediately after
-- session termination, not just when they expire naturally (15-min window).

-- 1. Store the JWT's jti on each session row for fast lookup at revocation time.
ALTER TABLE user_session
  ADD COLUMN IF NOT EXISTS jti UUID;

-- 2. Create the blocklist table (primary key on jti, index on expires_at for cleanup).
CREATE TABLE IF NOT EXISTS jti_blocklist (
  jti        UUID        NOT NULL PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS jti_blocklist_expires_idx
  ON jti_blocklist (expires_at);
