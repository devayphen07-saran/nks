-- Migration 024: Permissions Changelog
-- Enables true permission deltas for mobile reconnection sync.
-- Each row records one entity-permission change for one user at a specific version number.

CREATE TABLE IF NOT EXISTS permissions_changelog (
  id              BIGINT        NOT NULL PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_fk         BIGINT        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  version_number  INT           NOT NULL,
  entity_code     VARCHAR(100)  NOT NULL,
  operation       VARCHAR(10)   NOT NULL,  -- 'ADDED' | 'REMOVED' | 'MODIFIED'
  data            JSONB,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Primary query: fetch all changes for a user since version N
CREATE INDEX IF NOT EXISTS permissions_changelog_user_version_idx
  ON permissions_changelog (user_fk, version_number);
