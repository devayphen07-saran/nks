-- ✅ ISSUE #1 FIX: Add JWT token field to session
-- ✅ ISSUE #2 FIX: Add role hash field for change detection

-- Add roleHash column for detecting role changes
ALTER TABLE user_session
ADD COLUMN role_hash VARCHAR(64);

-- Add jwtToken column for storing signed JWT with embedded roles
ALTER TABLE user_session
ADD COLUMN jwt_token TEXT;

-- Create index on role_hash for faster role change detection queries
CREATE INDEX idx_user_session_role_hash
ON user_session(role_hash);
