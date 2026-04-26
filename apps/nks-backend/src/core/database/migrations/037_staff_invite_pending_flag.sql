-- ─── Migration 037: staff_invite — replace hardcoded status ID in unique index ─
--
-- Problem: the partial unique index on staff_invite used `status_fk = 1`
-- (hardcoding the PENDING status row's primary key). This breaks if the
-- staff_invite_status table is re-seeded or truncated in a different order.
--
-- Fix:
--   1. Add `is_pending boolean` to staff_invite_status — semantic marker
--      that identifies which status code is the "pending" state.
--   2. Add `is_pending boolean NOT NULL DEFAULT true` to staff_invite —
--      mirrors the status flag. Set false on any non-PENDING transition.
--      Used in the partial unique index so the constraint is ID-independent.
--      (PostgreSQL partial index predicates cannot reference other tables,
--      so a subquery approach is not possible.)
--   3. Drop the old index and create a new one using `is_pending = true`.
--   4. Backfill is_terminal on staff_invite_status rows that were missing it.

-- ─── 1. staff_invite_status — add is_pending ─────────────────────────────────

ALTER TABLE staff_invite_status
  ADD COLUMN IF NOT EXISTS is_pending boolean NOT NULL DEFAULT false;

UPDATE staff_invite_status SET is_pending = true  WHERE code = 'PENDING';
UPDATE staff_invite_status SET is_pending = false WHERE code != 'PENDING';

-- Backfill is_terminal (was DEFAULT false with no explicit value in old seed)
UPDATE staff_invite_status SET is_terminal = true  WHERE code IN ('ACCEPTED', 'REJECTED', 'REVOKED', 'EXPIRED');
UPDATE staff_invite_status SET is_terminal = false WHERE code = 'PENDING';

-- ─── 2. staff_invite — add is_pending ────────────────────────────────────────

ALTER TABLE staff_invite
  ADD COLUMN IF NOT EXISTS is_pending boolean NOT NULL DEFAULT true;

-- Backfill: any invite whose current status is not PENDING is not pending.
UPDATE staff_invite si
SET is_pending = false
WHERE EXISTS (
  SELECT 1 FROM staff_invite_status sis
  WHERE sis.id = si.status_fk AND sis.code != 'PENDING'
);

-- ─── 3. Replace the unique index ─────────────────────────────────────────────

DROP INDEX IF EXISTS staff_invite_pending_unique_idx;

CREATE UNIQUE INDEX staff_invite_pending_unique_idx
  ON staff_invite (store_fk, invitee_email)
  WHERE is_pending = true AND deleted_at IS NULL;
