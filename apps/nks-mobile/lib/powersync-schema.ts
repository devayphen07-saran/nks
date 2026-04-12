/**
 * PowerSync SQLite schema — mirrors the backend Drizzle tables.
 *
 * Rules:
 *  - All columns are nullable by default in PowerSync (SQLite)
 *  - Booleans → column.integer (0/1)
 *  - Timestamps → column.text (ISO 8601 strings)
 *  - Foreign keys → column.integer (bigint IDs)
 *  - The `id` column is managed by PowerSync — do not declare it here
 *
 * Add a new table here when you add sync columns to the backend schema.
 */

import { Schema, TableV2, column } from "@powersync/react-native";

// ─── routes ─────────────────────────────────────────────────────────────────
// Mirrors: apps/nks-backend/src/core/database/schema/rbac/routes/routes.table.ts
// Sync purpose: navigation tree available offline for route-guarding

const routes = new TableV2({
  // Hierarchy
  parent_route_fk: column.integer,

  // Route definition
  route_name: column.text,
  route_path: column.text,
  full_path: column.text,
  description: column.text,
  icon_name: column.text,

  // Enums stored as text in SQLite
  route_type: column.text,    // 'screen' | 'sidebar' | 'tab' | 'modal'
  route_scope: column.text,   // 'admin' | 'store' | 'personal'

  // Flags
  is_public: column.integer,  // boolean: 0 | 1

  // Optimistic concurrency (set by bump_version trigger on backend)
  version: column.integer,

  // Audit
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,    // soft delete — filter WHERE deleted_at IS NULL
});

// ─── Schema ──────────────────────────────────────────────────────────────────

export const AppSchema = new Schema({ routes });

export type Database = (typeof AppSchema)["types"];
