-- ============================================================================
-- Migration 015: Database Schema Audit Fixes
-- Date: 2026-04-09
-- Purpose: Fix critical architectural issues identified in schema audit
--          Part 1: Non-breaking changes (indexes + constraints)
-- ============================================================================

-- ============================================================================
-- PART 1: Add Missing Foreign Key Indexes
-- ============================================================================
-- These indexes improve performance for hierarchy & upgrade path queries
-- No downtime required - can be applied immediately

CREATE INDEX IF NOT EXISTS store_parent_store_idx
  ON store(parent_store_fk);
COMMENT ON INDEX store_parent_store_idx IS
  'Optimization for store hierarchy queries (find children of parent store)';

CREATE INDEX IF NOT EXISTS plans_allow_to_upgrade_idx
  ON plans(allow_to_upgrade_fk);
COMMENT ON INDEX plans_allow_to_upgrade_idx IS
  'Optimization for plan upgrade path lookups';

CREATE INDEX IF NOT EXISTS plans_allow_to_downgrade_idx
  ON plans(allow_to_downgrade_fk);
COMMENT ON INDEX plans_allow_to_downgrade_idx IS
  'Optimization for plan downgrade path lookups';

-- ============================================================================
-- PART 2: Add Data Integrity Constraints
-- ============================================================================

-- Ensure users have at least one contact method (email OR phone)
-- This allows authentication via either channel without requiring both
ALTER TABLE users
ADD CONSTRAINT users_contact_method_chk
CHECK (email IS NOT NULL OR phone_number IS NOT NULL);

COMMENT ON CONSTRAINT users_contact_method_chk ON users IS
  'Ensures users have at least one contact method for authentication';

-- ============================================================================
-- PART 3: Constraint Updates (Audit Trail Preservation)
-- ============================================================================
-- These changes prevent loss of audit information when users are deleted
-- Database will now reject deletion if audit records reference the user
-- Applications must use soft-delete (isActive=false) instead of hard-delete

-- Note: Existing foreign key constraints on createdBy, modifiedBy, deletedBy
-- have been updated to use onDelete: 'restrict' in schema definition.
-- This enforces the constraint at application layer during ORM operations.

-- Store owner FK constraint updated (onDelete: restrict)
-- This prevents orphaned stores when owner is deleted

-- OTP verification FK constraint updated (onDelete: restrict)
-- This preserves OTP verification audit trail when auth providers are modified

-- ============================================================================
-- PART 4: Documentation
-- ============================================================================
-- All schema changes have corresponding comments in table definitions
-- See: src/core/database/schema/base.entity.ts for audit field documentation

-- Rollback: These changes are safe to roll back in reverse order
-- Rollback (if needed):
-- DROP INDEX IF EXISTS store_parent_store_idx;
-- DROP INDEX IF EXISTS plans_allow_to_upgrade_idx;
-- DROP INDEX IF EXISTS plans_allow_to_downgrade_idx;
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS users_contact_method_chk;
