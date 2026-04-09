-- Add ip_hash column for privacy-safe device fingerprinting
-- Stores HMAC-SHA256 of the client IP keyed by IP_HMAC_SECRET
-- Raw ip_address is kept for human-readable audit/debug; ip_hash is used for fingerprint comparison
ALTER TABLE user_session ADD COLUMN IF NOT EXISTS ip_hash varchar(64);
