-- Migration: Rename pincode table to postal_code
-- Date: 2026-03-30
-- Purpose: Make postal code handling truly generic for all countries (not India-specific)

-- ============================================================================
-- STEP 1: Rename table from pincode to postal_code
-- ============================================================================
ALTER TABLE IF EXISTS public.pincode RENAME TO postal_code;

-- ============================================================================
-- STEP 2: Rename column postalCode to code for consistency
-- ============================================================================
ALTER TABLE public.postal_code RENAME COLUMN postal_code TO code;

-- ============================================================================
-- STEP 3: Rename indexes to reflect new table name
-- ============================================================================

-- Drop old indexes (if they exist with old naming)
DROP INDEX IF EXISTS public.pincode_postal_code_country_idx;
DROP INDEX IF EXISTS public.pincode_city_name_idx;
DROP INDEX IF EXISTS public.pincode_admin_div_idx;
DROP INDEX IF EXISTS public.pincode_state_idx;

-- Create new indexes with updated naming
CREATE UNIQUE INDEX postal_code_code_country_idx
    ON public.postal_code(code, country_fk)
    WHERE deleted_at IS NULL;

CREATE INDEX postal_code_city_name_idx ON public.postal_code(city_name);
CREATE INDEX postal_code_admin_div_idx ON public.postal_code(administrative_division_fk);
CREATE INDEX postal_code_state_idx ON public.postal_code(state_region_province_fk);

-- ============================================================================
-- Verification
-- ============================================================================
-- After running this migration, verify:
-- 1. SELECT COUNT(*) FROM public.postal_code; -- should have data
-- 2. SELECT column_name FROM information_schema.columns WHERE table_name = 'postal_code';
-- 3. Confirm 'code' column exists (renamed from 'postal_code')
