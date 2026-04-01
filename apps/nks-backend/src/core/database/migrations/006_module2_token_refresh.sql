-- ✅ MODULE 2: Token Refresh Strategy
-- Add refresh token support (SHA256 hash of opaque token)
-- Add separate access and refresh token expiry tracking

-- Add refresh token hash (never store plaintext)
ALTER TABLE user_session
ADD COLUMN refresh_token_hash VARCHAR(64);

-- Add refresh token expiry (30 days)
ALTER TABLE user_session
ADD COLUMN refresh_token_expires_at TIMESTAMP WITH TIME ZONE;

-- Add access token expiry (1 hour) — tracked separately from session expiry
ALTER TABLE user_session
ADD COLUMN access_token_expires_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for efficient token lookups
CREATE INDEX idx_user_session_refresh_token_hash
ON user_session(refresh_token_hash);

CREATE INDEX idx_user_session_refresh_token_expires
ON user_session(refresh_token_expires_at);

CREATE INDEX idx_user_session_access_token_expires
ON user_session(access_token_expires_at);
