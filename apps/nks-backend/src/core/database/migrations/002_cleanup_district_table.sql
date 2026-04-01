-- Migration: Cleanup old district table and columns
-- Date: 2026-03-30
-- Purpose: Remove India-specific district references after successful migration to administrative_division
--
-- WARNING: Run this migration ONLY after verifying migration 001 completed successfully
-- Verification steps:
-- 1. Verify all address records have administrative_division_fk populated if they had district_fk
-- 2. Verify all pincode records have administrative_division_fk populated
-- 3. Verify no application code references old district_fk columns
-- 4. Backup database before running this cleanup

-- ============================================================================
-- Drop old columns from address table
-- ============================================================================
ALTER TABLE public.address
    DROP COLUMN IF EXISTS district_fk CASCADE,
    DROP COLUMN IF EXISTS district_text CASCADE;

-- ============================================================================
-- Drop old column from pincode table
-- ============================================================================
ALTER TABLE public.pincode
    DROP COLUMN IF EXISTS district_fk CASCADE;

-- ============================================================================
-- Drop old district table
-- ============================================================================
DROP TABLE IF EXISTS public.district CASCADE;

-- ============================================================================
-- Recreate indexes without district references
-- ============================================================================

-- Drop old address index that referenced district_fk
DROP INDEX IF EXISTS idx_address CASCADE;

-- Create new address index
CREATE INDEX idx_address
    ON public.address (address_type_fk, city_fk, state_region_province_fk, administrative_division_fk, country_fk);

-- Drop old pincode indexes
DROP INDEX IF EXISTS pincode_district_idx CASCADE;
DROP INDEX IF EXISTS pincode_city_name_idx CASCADE;
DROP INDEX IF EXISTS pincode_state_idx CASCADE;

-- Recreate pincode indexes
CREATE INDEX pincode_city_name_idx ON public.pincode(city_name);
CREATE INDEX pincode_admin_div_idx ON public.pincode(administrative_division_fk);
CREATE INDEX pincode_state_idx ON public.pincode(state_region_province_fk);

-- ============================================================================
-- Verification
-- ============================================================================
-- Verify cleanup completed successfully:
-- 1. SELECT * FROM information_schema.columns WHERE table_name = 'address' AND column_name LIKE '%district%'; -- should return 0 rows
-- 2. SELECT * FROM information_schema.columns WHERE table_name = 'pincode' AND column_name LIKE '%district%'; -- should return 0 rows
-- 3. SELECT * FROM information_schema.tables WHERE table_name = 'district'; -- should return 0 rows
