import {
  timestamp,
  boolean,
  bigint,
  varchar,
  bigserial,
  integer,
} from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/**
 * coreEntity — minimal base for transactional tables (users, sessions, mappings, etc.)
 * Provides: PK, guuid, soft-delete flag, and timestamps.
 *
 * NOTE: This is a function so each table gets fresh column instances,
 * preventing constraint name collisions (e.g. "guuid_unique") across tables.
 */
export const coreEntity = () => ({
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  guuid: varchar('guuid', { length: 255 })
    .notNull()
    .unique()
    .$defaultFn(() => crypto.randomUUID()),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).$onUpdateFn(
    () => new Date(),
  ),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

/**
 * betterAuthEntity — minimal base for BetterAuth-managed tables
 * (user_session, user_auth_provider, otp_verification).
 * These tables are hard-deleted (CASCADE on user) — no soft-delete, no audit fields.
 */
export const betterAuthEntity = () => ({
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  guuid: varchar('guuid', { length: 255 })
    .notNull()
    .unique()
    .$defaultFn(() => crypto.randomUUID()),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).$onUpdateFn(
    () => new Date(),
  ),
});

/**
 * junctionEntity — minimal base for mapping/junction tables (user_role_mapping, etc.)
 * These tables have no guuid, no soft-delete, no audit trail — rows are inserted and hard-deleted.
 * The domain-specific "who did this" field (e.g. assignedBy) lives in the table itself.
 */
export const junctionEntity = () => ({
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * baseEntity — extended base for reference / lookup tables (roles, permissions, country, etc.)
 * Adds UI/system display fields on top of coreEntity:
 *   - sortOrder  – display ordering in dropdowns
 *   - isHidden   – exclude from UI lists without deleting
 *   - isSystem   – marks rows that cannot be deleted/modified by users
 */
export const baseEntity = () => ({
  ...coreEntity(),
  sortOrder: integer('sort_order'),
  isHidden: boolean('is_hidden').notNull().default(false),
  isSystem: boolean('is_system').notNull().default(false),
});

/**
 * appendOnlyEntity — minimal base for append-only immutable tables (audit_logs).
 * Rows are written once and never updated or soft-deleted.
 * No guuid, no isActive, no updatedAt, no deletedAt — just id + createdAt.
 */
export const appendOnlyEntity = () => ({
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * auditFields — who created/modified/deleted a row.
 * Use on tables where human-initiated writes need attribution.
 * Skip on BetterAuth-managed tables (user_session, user_auth_provider, otp_verification).
 *
 * CRITICAL: Uses onDelete: 'restrict' to prevent audit trail loss.
 * When a user is deleted, their audit trail records MUST be preserved for compliance (SOX, GDPR).
 * Instead of allowing NULL createdBy, the deletion is prevented at DB level.
 * Deleted users should be archived (is_active = false) rather than hard-deleted.
 */
export const auditFields = (getUsersId: () => AnyPgColumn) => ({
  createdBy: bigint('created_by', { mode: 'number' }).references(getUsersId, {
    onDelete: 'restrict', // ← CHANGED: prevent loss of audit trail
  }),
  modifiedBy: bigint('modified_by', { mode: 'number' }).references(getUsersId, {
    onDelete: 'restrict', // ← CHANGED: prevent loss of audit trail
  }),
  deletedBy: bigint('deleted_by', { mode: 'number' }).references(getUsersId, {
    onDelete: 'restrict', // ← CHANGED: prevent loss of audit trail
  }),
});
