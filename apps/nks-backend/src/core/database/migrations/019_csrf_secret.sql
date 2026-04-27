-- Add per-session CSRF secret to user_session.
-- CSRF token = HMAC-SHA256(csrf_secret, CSRF_HMAC_SECRET).
-- NULL for existing sessions — they fall back to the old HMAC(token, secret) formula
-- until they rotate (rolling rotation or explicit refresh).
ALTER TABLE user_session
  ADD COLUMN IF NOT EXISTS csrf_secret VARCHAR(64);
