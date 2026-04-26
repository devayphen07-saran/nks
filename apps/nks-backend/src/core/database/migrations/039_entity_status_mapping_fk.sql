-- ─── Migration 039: entity_status_mapping — add FK to entity_type.code ───────
--
-- Problem: entity_status_mapping.entity_code was a free-text varchar.
-- A typo in entity_code produced a silent orphan row with no entity to apply to.
--
-- Root cause: entity_type.code uses UPPERCASE (SCREAMING_SNAKE_CASE), but the
-- seed and EntityCodeValidator both used lowercase. The two systems could never
-- be FK-linked while the case convention differed.
--
-- Fix:
--   1. Uppercase all existing entity_code values in entity_status_mapping.
--   2. Add FK REFERENCES entity_type(code) ON DELETE RESTRICT.
--      (entity_type.code already has a UNIQUE constraint — valid FK target.)
--
-- API impact: zero. EntityCodeValidator.normalize() already uppercases before
-- any DB lookup, so callers may continue passing lowercase in URLs.

-- ─── 1. Backfill — uppercase all existing entity_code rows ───────────────────

UPDATE entity_status_mapping SET entity_code = UPPER(entity_code);

-- ─── 2. Add FK constraint ─────────────────────────────────────────────────────

ALTER TABLE entity_status_mapping
  ADD CONSTRAINT entity_status_mapping_entity_code_fk
  FOREIGN KEY (entity_code) REFERENCES entity_type(code) ON DELETE RESTRICT;
