-- ─── Migration 044: users — permissions_version varchar → integer ─────────────
--
-- Problem: permissions_version was stored as a 'vN' prefixed string (e.g. 'v1',
-- 'v12'). This meant:
--   • Incrementing required: 'v' || (CAST(SUBSTRING(permissions_version FROM 2) AS INT) + 1)
--   • ORDER BY sorted lexicographically ('v9' > 'v10')
--   • No range or arithmetic operators without a cast
--
-- Fix: change to integer. Store plain 1, 2, 3… instead of 'v1', 'v2', 'v3'…
-- API layer still accepts 'v3' format from clients for backward compatibility
-- (parseVersionNumber strips the prefix).

-- Strip the 'v' prefix from all existing values and cast to integer.
ALTER TABLE users
  ALTER COLUMN permissions_version TYPE integer
  USING SUBSTRING(permissions_version FROM 2)::integer;

-- Update the column default from 'v1' to 1.
ALTER TABLE users
  ALTER COLUMN permissions_version SET DEFAULT 1;
