-- ============================================================================
-- Migration 017: Remove Pincode Denormalization
-- Date: 2026-04-09
-- Purpose: Remove redundant stateFk from pincode table
--          Part 3: Breaking changes - MAJOR VERSION REQUIRED
-- ============================================================================
-- BREAKING CHANGE: Removes a column from the API response
-- This requires:
-- 1. Frontend/mobile app updates to not expect stateFk in pincode
-- 2. Backend API updates to not include stateFk in responses
-- 3. All queries updated to derive state via district FK
-- ============================================================================

-- ============================================================================
-- Context
-- ============================================================================
-- The pincode table had two FKs to state:
--   1. Direct: pincode.stateFk → state.id
--   2. Via district: pincode.districtFk → district.id → district.stateFk → state.id
--
-- This created a denormalization problem:
--   - Risk: pincode.stateFk could differ from district.stateFk (data inconsistency)
--   - Redundancy: State information already available via district
--
-- Solution: Remove pincode.stateFk, derive state via district join

-- ============================================================================
-- PART 1: Remove Redundant Column
-- ============================================================================

-- First, verify data integrity (optional, but recommended)
-- SELECT COUNT(DISTINCT state_fk) FROM pincode WHERE state_fk IS NOT NULL;

-- Remove the index on the foreign key
DROP INDEX IF EXISTS pincode_state_idx;

-- Remove the foreign key constraint
ALTER TABLE pincode
DROP CONSTRAINT IF EXISTS pincode_state_fk;

-- Remove the column
ALTER TABLE pincode
DROP COLUMN IF EXISTS state_fk;

-- ============================================================================
-- PART 2: Verify Data Consistency
-- ============================================================================
-- After removal, verify that district information is still intact:
-- SELECT p.id, p.code, d.id as district_id, d.state_fk as state_id
-- FROM pincode p
-- JOIN district d ON p.district_fk = d.id
-- LIMIT 10;

-- ============================================================================
-- PART 3: Update Application Code
-- ============================================================================
-- Required changes in application:
--
-- 1. Update DTOs (location-response.dto.ts):
--    Remove stateFk from PincodeResponse interface
--
-- 2. Update API responses:
--    - Pincode endpoints no longer include stateFk
--    - Frontend must derive state via district.stateFk if needed
--
-- 3. Update repositories/services:
--    - If state info needed, join to district table
--    - Example query:
--      SELECT p.*, d.state_fk
--      FROM pincode p
--      JOIN district d ON p.district_fk = d.id
--      WHERE p.id = ?
--
-- 4. Update schema relationships (pincode.relations.ts):
--    - Already updated in schema definition
--    - State is now accessed via district relation
--
-- 5. Update seeds/fixtures:
--    - No longer populate state_fk for pincode records

-- ============================================================================
-- PART 4: Migration Impact
-- ============================================================================
-- Impact Analysis:
-- - Data loss: NO (column not referenced, only denormalized)
-- - Breaking API change: YES (stateFk removed from pincode response)
-- - Performance impact: MINIMAL (index removed, but not heavily used)
-- - Backward compatibility: NO (requires API version bump)
--
-- Recommended approach:
-- 1. Deploy new app code first (handle missing stateFk gracefully)
-- 2. Run migration at maintenance window
-- 3. Verify data integrity post-migration
--
-- Verification (run after migration):
-- SELECT COUNT(*) FROM pincode;  -- Should return same count as before
-- SELECT COUNT(DISTINCT district_fk) FROM pincode;  -- All should have district

-- ============================================================================
-- Rollback Instructions (if needed)
-- ============================================================================
-- To rollback this migration:
-- 1. Restore state_fk column
-- 2. Restore foreign key constraint
-- 3. Restore index
-- 4. Repopulate state_fk data from district table
--
-- SQL (approximate):
-- ALTER TABLE pincode ADD COLUMN state_fk bigint;
-- UPDATE pincode SET state_fk = (SELECT state_fk FROM district WHERE id = pincode.district_fk);
-- ALTER TABLE pincode ADD CONSTRAINT pincode_state_fk
--   FOREIGN KEY (state_fk) REFERENCES state(id) ON DELETE RESTRICT;
-- CREATE INDEX pincode_state_idx ON pincode(state_fk);

-- ============================================================================
-- Testing Checklist
-- ============================================================================
-- After migration, verify:
-- [ ] All pincode records still intact (count matches)
-- [ ] district_fk relationships still valid (no orphans)
-- [ ] API returns pincode without stateFk
-- [ ] Mobile/web apps handle missing stateFk gracefully
-- [ ] State can be derived via district join (if needed)
-- [ ] Database constraints all valid
-- [ ] No errors in application logs
