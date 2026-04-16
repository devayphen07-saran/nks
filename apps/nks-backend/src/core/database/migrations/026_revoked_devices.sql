-- Migration 026: Revoked devices table for offline token revocation
-- Tracks devices whose offline sync access was explicitly revoked (e.g., stolen device).
-- SyncService checks this table on POST /sync/push to reject revoked devices even
-- if their 3-day offline HMAC signature is still cryptographically valid.

CREATE TABLE IF NOT EXISTS revoked_devices (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_fk    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id  VARCHAR(255) NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_by BIGINT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS revoked_devices_user_device_idx ON revoked_devices (user_fk, device_id);
CREATE INDEX IF NOT EXISTS revoked_devices_revoked_at_idx  ON revoked_devices (revoked_at);
