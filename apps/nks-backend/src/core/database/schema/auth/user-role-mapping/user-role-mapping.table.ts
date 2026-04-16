import {
  pgTable,
  bigint,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { coreEntity } from '../../base.entity';
import { users } from '../../auth/users';
import { roles } from '../../rbac/roles';
import { store } from '../../store/store';

/**
 * USER_ROLE_MAPPING
 *
 * Single source of truth for every role a user holds, replacing the previous
 * users.global_role enum and store_user_mapping.store_role / customRoleFk columns.
 *
 * A row here means: "user X has role Y [in store Z]"
 *
 *   store_fk IS NULL  → platform-level role  (SUPER_ADMIN, USER)
 *   store_fk IS NOT NULL → store-scoped role (STORE_OWNER, STAFF, CASHIER …)
 *
 * isPrimary = true marks the single role whose code flows into JWT.primaryRole
 * for a given context (global OR per-store). Enforced by partial unique indexes.
 */
export const userRoleMapping = pgTable(
  'user_role_mapping',
  {
    ...coreEntity(),

    userFk: bigint('user_fk', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    roleFk: bigint('role_fk', { mode: 'number' })
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),

    // null  → platform-level role (SUPER_ADMIN, USER)
    // value → store-scoped role
    storeFk: bigint('store_fk', { mode: 'number' }).references(
      () => store.id,
      { onDelete: 'cascade' },
    ),

    // Marks the role whose code is written into JWT.primaryRole.
    // One primary per platform context (store_fk IS NULL) and one per store.
    isPrimary: boolean('is_primary').notNull().default(false),

    assignedBy: bigint('assigned_by', { mode: 'number' }).references(
      () => users.id,
      { onDelete: 'set null' },
    ),

    assignedAt: timestamp('assigned_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Optional expiry for temporary role grants (e.g., trial MANAGER for 7 days).
    // NULL means the assignment never expires.
    // AuthGuard filters out rows where expires_at < NOW().
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    // ── Uniqueness ─────────────────────────────────────────────────────────
    // One active assignment per user+role in the global (platform) context
    uniqueIndex('urm_unique_global_idx')
      .on(table.userFk, table.roleFk)
      .where(sql`store_fk IS NULL AND deleted_at IS NULL`),

    // One active assignment per user+role+store in the store context
    uniqueIndex('urm_unique_store_idx')
      .on(table.userFk, table.roleFk, table.storeFk)
      .where(sql`store_fk IS NOT NULL AND deleted_at IS NULL`),

    // Only one primary role per user in the global context
    uniqueIndex('urm_primary_global_idx')
      .on(table.userFk)
      .where(sql`store_fk IS NULL AND is_primary = true AND deleted_at IS NULL`),

    // Only one primary role per user per store
    uniqueIndex('urm_primary_store_idx')
      .on(table.userFk, table.storeFk)
      .where(
        sql`store_fk IS NOT NULL AND is_primary = true AND deleted_at IS NULL`,
      ),

    // ── Lookup indexes ──────────────────────────────────────────────────────
    index('urm_user_idx').on(table.userFk),
    index('urm_role_idx').on(table.roleFk),
    index('urm_store_idx').on(table.storeFk),
    index('urm_user_store_idx').on(table.userFk, table.storeFk),
    index('urm_expires_at_idx').on(table.expiresAt),
  ],
);

export type UserRoleMapping = typeof userRoleMapping.$inferSelect;
export type NewUserRoleMapping = typeof userRoleMapping.$inferInsert;
export type UpdateUserRoleMapping = Partial<Omit<NewUserRoleMapping, 'id'>>;
