-- ============================================================================
-- Migration 016: Standardize Timestamp Fields
-- Date: 2026-04-09
-- Purpose: Convert date fields to timestamp with timezone for consistency
--          Part 2: Breaking changes - requires data migration
-- ============================================================================
-- WARNING: This migration changes column types. Requires careful testing.
-- Recommend: Test on backup first, deploy during maintenance window
-- ============================================================================

-- ============================================================================
-- PART 1: Subscription Table Timestamp Conversion
-- ============================================================================
-- Convert firstInvoiceRecordedAt and trialEnd from date to timestamp

-- Step 1: Add new columns with timestamp type
ALTER TABLE subscription
ADD COLUMN first_invoice_recorded_at_new timestamp with time zone,
ADD COLUMN trial_end_new timestamp with time zone;

-- Step 2: Migrate data (cast date to timestamp)
UPDATE subscription
SET
  first_invoice_recorded_at_new = first_invoice_recorded_at::timestamp with time zone,
  trial_end_new = trial_end::timestamp with time zone
WHERE first_invoice_recorded_at IS NOT NULL OR trial_end IS NOT NULL;

-- Step 3: Drop old columns
ALTER TABLE subscription
DROP COLUMN first_invoice_recorded_at,
DROP COLUMN trial_end;

-- Step 4: Rename new columns to original names
ALTER TABLE subscription
RENAME COLUMN first_invoice_recorded_at_new TO first_invoice_recorded_at;

ALTER TABLE subscription
RENAME COLUMN trial_end_new TO trial_end;

-- Add comments
COMMENT ON COLUMN subscription.first_invoice_recorded_at IS
  'Timestamp when first invoice was recorded (timezone-aware)';
COMMENT ON COLUMN subscription.trial_end IS
  'End of trial period (timezone-aware)';

-- ============================================================================
-- PART 2: Subscription Item Table Timestamp Conversion
-- ============================================================================
-- Convert effectiveFrom and effectiveTo from date to timestamp

ALTER TABLE subscription_item
ADD COLUMN effective_from_new timestamp with time zone,
ADD COLUMN effective_to_new timestamp with time zone;

UPDATE subscription_item
SET
  effective_from_new = effective_from::timestamp with time zone,
  effective_to_new = effective_to::timestamp with time zone
WHERE effective_from IS NOT NULL OR effective_to IS NOT NULL;

ALTER TABLE subscription_item
DROP COLUMN effective_from,
DROP COLUMN effective_to;

ALTER TABLE subscription_item
RENAME COLUMN effective_from_new TO effective_from;

ALTER TABLE subscription_item
RENAME COLUMN effective_to_new TO effective_to;

COMMENT ON COLUMN subscription_item.effective_from IS
  'Effective start date for this subscription item (timezone-aware)';
COMMENT ON COLUMN subscription_item.effective_to IS
  'Effective end date for this subscription item (timezone-aware)';

-- ============================================================================
-- PART 3: Tax Rate Master Table Timestamp Conversion
-- ============================================================================
-- Convert effectiveFrom and effectiveTo from date to timestamp

ALTER TABLE tax_rate_master
ADD COLUMN effective_from_new timestamp with time zone,
ADD COLUMN effective_to_new timestamp with time zone;

UPDATE tax_rate_master
SET
  effective_from_new = effective_from::timestamp with time zone,
  effective_to_new = effective_to::timestamp with time zone
WHERE effective_from IS NOT NULL OR effective_to IS NOT NULL;

ALTER TABLE tax_rate_master
DROP COLUMN effective_from,
DROP COLUMN effective_to;

ALTER TABLE tax_rate_master
RENAME COLUMN effective_from_new TO effective_from;

ALTER TABLE tax_rate_master
RENAME COLUMN effective_to_new TO effective_to;

COMMENT ON COLUMN tax_rate_master.effective_from IS
  'Date this tax rate becomes effective (timezone-aware)';
COMMENT ON COLUMN tax_rate_master.effective_to IS
  'Date this tax rate expires (timezone-aware, NULL = still active)';

-- ============================================================================
-- PART 4: Index Maintenance (if needed)
-- ============================================================================
-- These indexes on date columns should be automatically maintained
-- ANALYZE can be run after migration to update statistics
ANALYZE subscription;
ANALYZE subscription_item;
ANALYZE tax_rate_master;

-- ============================================================================
-- Verification Queries (run after migration)
-- ============================================================================
-- SELECT COUNT(*) FROM subscription WHERE first_invoice_recorded_at IS NOT NULL;
-- SELECT COUNT(*) FROM subscription_item WHERE effective_from IS NOT NULL;
-- SELECT COUNT(*) FROM tax_rate_master WHERE effective_from IS NOT NULL;

-- ============================================================================
-- Rollback Instructions
-- ============================================================================
-- If migration fails, use these commands to rollback (in reverse order):
-- 1. Recreate date columns from timestamps
-- 2. Migrate data back
-- 3. Drop timestamp columns
-- Note: Data may lose time-of-day precision when converting back to date
