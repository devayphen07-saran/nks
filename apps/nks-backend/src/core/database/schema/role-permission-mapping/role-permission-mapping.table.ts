import { pgTable, bigint, unique, index } from 'drizzle-orm/pg-core';
import { roles } from '../roles';
import { permissions } from '../permissions';
import { users } from '../users';
import { junctionEntity } from '../base.entity';

// storeFk is intentionally absent — roles already carry storeFk, so scope is
// determined by the role itself. Adding storeFk here would create an ambiguity
// (which store wins?) and a potential mismatch (role belongs to store A but mapping says store B).
export const rolePermissionMapping = pgTable(
  'role_permission_mapping',
  {
    ...junctionEntity(),

    roleFk: bigint('role_fk', { mode: 'number' })
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionFk: bigint('permission_fk', { mode: 'number' })
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),

    assignedBy: bigint('assigned_by', { mode: 'number' }).references(
      () => users.id,
      { onDelete: 'set null' },
    ),
  },
  (table) => [
    unique('role_permission_mapping_unique_idx').on(
      table.roleFk,
      table.permissionFk,
    ),
    // role_fk covered by the composite unique above (leading column)
    index('role_permission_mapping_permission_idx').on(table.permissionFk),
    // assigned_by — for audit tracking
    index('role_permission_mapping_assigned_by_idx').on(table.assignedBy),
  ],
);

export type RolePermissionMapping = typeof rolePermissionMapping.$inferSelect;
export type NewRolePermissionMapping =
  typeof rolePermissionMapping.$inferInsert;
export type UpdateRolePermissionMapping = Partial<
  Omit<NewRolePermissionMapping, 'id'>
>;
