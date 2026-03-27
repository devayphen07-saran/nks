import { pgTable, bigint, unique, index } from 'drizzle-orm/pg-core';
import { junctionEntity } from '../base.entity';
import { users } from '../users';
import { permissions } from '../permissions';
import { store } from '../store';

export const userPermissionMapping = pgTable(
  'user_permission_mapping',
  {
    ...junctionEntity(),

    userFk: bigint('user_fk', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permissionFk: bigint('permission_fk', { mode: 'number' })
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    storeFk: bigint('store_fk', { mode: 'number' })
      .notNull()
      .references(() => store.id, { onDelete: 'cascade' }),

    assignedBy: bigint('assigned_by', { mode: 'number' }).references(
      () => users.id,
      { onDelete: 'set null' },
    ),
  },
  (table) => [
    unique('user_permission_mapping_unique_idx').on(
      table.userFk,
      table.permissionFk,
      table.storeFk,
    ),
    index('user_permission_mapping_user_idx').on(table.userFk),
  ],
);

export type UserPermissionMapping = typeof userPermissionMapping.$inferSelect;
export type NewUserPermissionMapping =
  typeof userPermissionMapping.$inferInsert;
export type UpdateUserPermissionMapping = Partial<
  Omit<NewUserPermissionMapping, 'id'>
>;
