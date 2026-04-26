-- ─── Migration 045: move two_factor_enabled from user_preferences → users ─────
--
-- Problem: two_factor_enabled was in user_preferences. The authentication flow
-- reads this flag on every login, requiring a JOIN to a second table for a
-- security-critical decision. It belongs on users alongside other auth flags
-- (email_verified, phone_number_verified, is_blocked).
--
-- Fix:
--   1. Add two_factor_enabled to users (default false).
--   2. Backfill from user_preferences where the flag was already true.
--   3. Drop the column from user_preferences.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT false;

-- Backfill: copy any rows that had two_factor_enabled = true in user_preferences.
UPDATE users u
SET two_factor_enabled = true
WHERE EXISTS (
  SELECT 1 FROM user_preferences up
  WHERE up.user_fk = u.id AND up.two_factor_enabled = true
);

ALTER TABLE user_preferences DROP COLUMN IF EXISTS two_factor_enabled;
