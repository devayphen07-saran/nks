-- 055_entity_type_hierarchy.sql
-- Adds parent-child hierarchy and defaultAllow to entity_type.
-- parent_entity_type_fk: groups features under a module (e.g. PRODUCTS under INVENTORY).
-- default_allow: if true, all roles can access this entity without an explicit role_permissions row.

ALTER TABLE entity_type
  ADD COLUMN parent_entity_type_fk BIGINT
    REFERENCES entity_type(id) ON DELETE SET NULL,
  ADD COLUMN default_allow BOOLEAN NOT NULL DEFAULT false;

-- Tree traversal index: children of a given parent.
CREATE INDEX entity_type_parent_fk_idx
  ON entity_type(parent_entity_type_fk)
  WHERE parent_entity_type_fk IS NOT NULL AND deleted_at IS NULL;
