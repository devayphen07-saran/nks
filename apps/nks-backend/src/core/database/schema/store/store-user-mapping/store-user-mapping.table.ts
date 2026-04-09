import {
  pgTable,
  bigint,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '../../auth/users';
import { store } from '../../store/store';
import { codeValue } from '../../lookups/code-value/code-value.table';
import { coreEntity } from '../../base.entity';

/**
 * STORE_USER_MAPPING
 *
 * Pure membership table — tracks which users belong to which stores and when.
 * Role assignment is handled entirely by user_role_mapping.
 *
 * Soft-delete strategy:
 *   - Active membership: deleted_at IS NULL
 *   - Left/removed:      deleted_at IS NOT NULL (record kept for audit)
 *   - Uniqueness enforced only on active rows (partial unique index)
 */
export const storeUserMapping = pgTable(
  'store_user_mapping',
  {
    // coreEntity: id, guuid, isActive, createdAt, updatedAt, deletedAt
    ...coreEntity(),

    storeFk: bigint('store_fk', { mode: 'number' })
      .notNull()
      .references(() => store.id, { onDelete: 'cascade' }),
    userFk: bigint('user_fk', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Designation from code_value (DESIGNATION category: CEO, STORE_MGR, CASHIER, etc.)
    designationFk: bigint('designation_fk', { mode: 'number' }).references(
      () => codeValue.id,
      { onDelete: 'set null' },
    ),

    joinedDate: timestamp('joined_date', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Domain audit: who assigned this user to the store
    assignedBy: bigint('assigned_by', { mode: 'number' }).references(
      () => users.id,
      { onDelete: 'set null' },
    ),

    // Who last modified this membership record
    modifiedBy: bigint('modified_by', { mode: 'number' }).references(
      () => users.id,
      { onDelete: 'set null' },
    ),

    // Who removed this user from the store (set on soft-delete)
    deletedBy: bigint('deleted_by', { mode: 'number' }).references(
      () => users.id,
      { onDelete: 'set null' },
    ),
  },
  (table) => [
    // Only one ACTIVE membership per user per store.
    uniqueIndex('store_user_mapping_active_unique_idx')
      .on(table.storeFk, table.userFk)
      .where(sql`deleted_at IS NULL`),

    index('store_user_mapping_user_idx').on(table.userFk),
    index('store_user_mapping_designation_idx').on(table.designationFk),
    index('store_user_mapping_assigned_by_idx').on(table.assignedBy),
  ],
);

export type StoreUserMapping = typeof storeUserMapping.$inferSelect;
export type NewStoreUserMapping = typeof storeUserMapping.$inferInsert;
export type UpdateStoreUserMapping = Partial<Omit<NewStoreUserMapping, 'id'>>;
