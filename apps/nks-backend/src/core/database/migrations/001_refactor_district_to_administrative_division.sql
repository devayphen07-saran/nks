-- Migration: Refactor district table to generic administrative_division table
-- Date: 2026-03-30
-- Purpose: Make address handling truly multi-country by replacing India-specific district table
--          with a generic administrative_division table that supports all countries

-- ============================================================================
-- STEP 1: Create the new administrative_division table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.administrative_division
(
    id                       BIGSERIAL PRIMARY KEY,
    division_name            VARCHAR(100) NOT NULL,
    division_code            VARCHAR(20),
    division_type            VARCHAR(50) NOT NULL DEFAULT 'DISTRICT',
    description              VARCHAR(255),
    state_region_province_fk BIGINT REFERENCES public.state_region_province(id) ON DELETE RESTRICT,
    country_fk               BIGINT NOT NULL REFERENCES public.country(id) ON DELETE RESTRICT,
    is_active                BOOLEAN DEFAULT TRUE,
    deleted_at               TIMESTAMPTZ,
    created_by               BIGINT REFERENCES public.users(id),
    created_at               TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    modified_by              BIGINT REFERENCES public.users(id),
    modified_at              TIMESTAMPTZ,
    deleted_by               BIGINT REFERENCES public.users(id)
);

-- Indexes for administrative_division
CREATE INDEX IF NOT EXISTS admin_div_state_idx ON public.administrative_division(state_region_province_fk);
CREATE INDEX IF NOT EXISTS admin_div_country_idx ON public.administrative_division(country_fk);
CREATE INDEX IF NOT EXISTS admin_div_type_idx ON public.administrative_division(division_type);

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS admin_div_name_state_idx
    ON public.administrative_division(division_name, state_region_province_fk)
    WHERE state_region_province_fk IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS admin_div_name_country_idx
    ON public.administrative_division(division_name, country_fk)
    WHERE state_region_province_fk IS NULL AND deleted_at IS NULL;

-- ============================================================================
-- STEP 2: Migrate data from district to administrative_division
-- ============================================================================
-- This assumes district table exists and has data
INSERT INTO public.administrative_division (
    division_name,
    division_code,
    division_type,
    description,
    state_region_province_fk,
    country_fk,
    is_active,
    deleted_at,
    created_by,
    created_at,
    modified_by,
    modified_at,
    deleted_by
)
SELECT
    d.district_name,
    d.district_code,
    'DISTRICT',  -- Mark migrated data as DISTRICT type (can be updated per country later)
    d.description,
    d.state_region_province_fk,
    srp.country_fk,
    d.is_active,
    d.deleted_at,
    d.created_by,
    d.created_at,
    d.modified_by,
    d.modified_at,
    d.deleted_by
FROM public.district d
JOIN public.state_region_province srp ON d.state_region_province_fk = srp.id
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 3: Update address table - Replace district with administrative_division
-- ============================================================================

-- Add new column
ALTER TABLE public.address
    ADD COLUMN IF NOT EXISTS administrative_division_fk BIGINT REFERENCES public.administrative_division(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS administrative_division_text VARCHAR(100);

-- Migrate data from old columns to new columns
UPDATE public.address a
SET administrative_division_fk = ad.id
FROM public.administrative_division ad
WHERE a.district_fk IS NOT NULL
    AND a.district_fk = ad.id
    AND a.administrative_division_fk IS NULL;

-- Copy text values
UPDATE public.address
SET administrative_division_text = district_text
WHERE district_text IS NOT NULL
    AND administrative_division_text IS NULL;

-- Add constraint to ensure FK or text is used, not both
ALTER TABLE public.address
    ADD CONSTRAINT IF NOT EXISTS address_admin_div_fk_or_text_chk
        CHECK (administrative_division_fk IS NULL OR administrative_division_text IS NULL);

-- ============================================================================
-- STEP 4: Update pincode table - Replace district with administrative_division
-- ============================================================================

-- Add new column
ALTER TABLE public.pincode
    ADD COLUMN IF NOT EXISTS administrative_division_fk BIGINT NOT NULL DEFAULT 0 REFERENCES public.administrative_division(id) ON DELETE RESTRICT;

-- Migrate data
UPDATE public.pincode p
SET administrative_division_fk = ad.id
FROM public.administrative_division ad
WHERE p.district_fk IS NOT NULL
    AND p.district_fk = ad.id;

-- Remove default constraint after migration
ALTER TABLE public.pincode
    ALTER COLUMN administrative_division_fk DROP DEFAULT;

-- ============================================================================
-- STEP 5: Drop old columns and indexes (only after verifying migration)
-- ============================================================================
-- These should be dropped in a separate migration after verification

-- NOTE: To complete the migration, run the following in a separate transaction:
/*
-- Drop old column from address
ALTER TABLE public.address DROP COLUMN IF EXISTS district_fk CASCADE;
ALTER TABLE public.address DROP COLUMN IF EXISTS district_text CASCADE;

-- Drop old column from pincode
ALTER TABLE public.pincode DROP COLUMN IF EXISTS district_fk CASCADE;

-- Drop old district table
DROP TABLE IF EXISTS public.district CASCADE;

-- Drop old index on address
DROP INDEX IF EXISTS idx_address CASCADE;

-- Recreate index without district_fk reference
CREATE INDEX idx_address ON public.address (address_type_fk, city_fk, state_region_province_fk, administrative_division_fk, country_fk);

-- Drop old pincode indexes
DROP INDEX IF EXISTS pincode_district_idx CASCADE;
DROP INDEX IF EXISTS pincode_city_name_idx CASCADE;
DROP INDEX IF EXISTS pincode_state_idx CASCADE;

-- Recreate pincode indexes
CREATE INDEX pincode_city_name_idx ON public.pincode(city_name);
CREATE INDEX pincode_admin_div_idx ON public.pincode(administrative_division_fk);
CREATE INDEX pincode_state_idx ON public.pincode(state_region_province_fk);
*/

-- ============================================================================
-- Verification
-- ============================================================================
-- After running this migration, verify:
-- 1. SELECT COUNT(*) FROM public.administrative_division; -- should have data
-- 2. SELECT COUNT(*) FROM public.address WHERE administrative_division_fk IS NOT NULL; -- verify migration
-- 3. SELECT COUNT(*) FROM public.pincode WHERE administrative_division_fk > 0; -- verify migration
