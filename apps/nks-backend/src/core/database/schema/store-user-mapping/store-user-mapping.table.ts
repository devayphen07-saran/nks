import {
  pgTable,
  bigint,
  boolean,
  timestamp,
  unique,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '../users';
import { store } from '../store';
import { designation } from '../designation';
import { junctionEntity } from '../base.entity';

export const storeUserMapping = pgTable(
  'store_user_mapping',
  {
    ...junctionEntity(),

    storeFk: bigint('store_fk', { mode: 'number' })
      .notNull()
      .references(() => store.id, { onDelete: 'cascade' }),
    userFk: bigint('user_fk', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    designationFk: bigint('designation_fk', { mode: 'number' }).references(
      () => designation.id,
      { onDelete: 'set null' },
    ),

    isPrimary: boolean('is_primary').notNull().default(false),
    joinedDate: timestamp('joined_date', { withTimezone: true })
      .notNull()
      .defaultNow(),

    assignedBy: bigint('assigned_by', { mode: 'number' }).references(
      () => users.id,
      { onDelete: 'set null' },
    ),
  },
  (table) => [
    unique('store_user_mapping_unique_idx').on(table.storeFk, table.userFk),
    // user_fk — for "show all stores this user belongs to"
    index('store_user_mapping_user_idx').on(table.userFk),
    // store_fk covered by composite unique above (leading column)
    // designation_fk — for "show all staff with a given designation"
    index('store_user_mapping_designation_idx').on(table.designationFk),
    // assigned_by — for audit and RBAC tracking
    index('store_user_mapping_assigned_by_idx').on(table.assignedBy),

    // Enforce exactly one primary owner per store at the DB level.
    // Partial unique — ONLY the primary row is constrained.
    uniqueIndex('store_user_mapping_one_primary_idx')
      .on(table.storeFk)
      .where(sql`is_primary = true`),
  ],
);

export type StoreUserMapping = typeof storeUserMapping.$inferSelect;
export type NewStoreUserMapping = typeof storeUserMapping.$inferInsert;
export type UpdateStoreUserMapping = Partial<Omit<NewStoreUserMapping, 'id'>>;
