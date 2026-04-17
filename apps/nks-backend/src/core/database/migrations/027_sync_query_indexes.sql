-- Migration 027: Add indexes on updated_at for sync-critical tables
-- These three tables are queried in every sync pull via WHERE updated_at > cursor.
-- Without an index, each sync request performs a full-table scan which degrades
-- to O(N) on large datasets and can be used as a denial-of-service vector.
--
-- All indexes are conditional (WHERE deleted_at IS NULL) to keep index size small
-- and ensure only active rows are indexed for the common pull-sync path.

-- routes: synced by all mobile clients for navigation/permission tree
CREATE INDEX IF NOT EXISTS routes_updated_at_idx
  ON routes (updated_at)
  WHERE deleted_at IS NULL;

-- state: synced as location reference data (states of India)
CREATE INDEX IF NOT EXISTS state_updated_at_idx
  ON state (updated_at)
  WHERE deleted_at IS NULL;

-- district: synced as location reference data (~766 Indian districts)
CREATE INDEX IF NOT EXISTS district_updated_at_idx
  ON district (updated_at)
  WHERE deleted_at IS NULL;
