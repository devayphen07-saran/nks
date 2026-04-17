-- Migration 022: Rate limit entries table
-- Database-backed rate limiting. One row per unique key (IP+path).
-- Tracks hits within the current sliding window.
-- Survives restarts and works across multiple replica instances.

CREATE TABLE IF NOT EXISTS rate_limit_entries (
  key          TEXT        NOT NULL PRIMARY KEY,
  hits         INTEGER     NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_entries_window_idx ON rate_limit_entries (window_start);
