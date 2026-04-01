-- Migration: Add roles to user session for token payload
-- Date: 2026-03-31
-- Purpose: Include user roles in the session token to reduce database lookups

ALTER TABLE public.user_session
  ADD COLUMN IF NOT EXISTS user_roles TEXT, -- JSON stringified array of role objects
  ADD COLUMN IF NOT EXISTS primary_role VARCHAR(50); -- Primary role code (SUPER_ADMIN, STORE_OWNER, etc.)

-- Create index on primary_role for faster filtering
CREATE INDEX IF NOT EXISTS user_session_primary_role_idx ON public.user_session(primary_role);
