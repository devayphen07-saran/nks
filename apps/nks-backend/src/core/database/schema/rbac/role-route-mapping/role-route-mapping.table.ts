import { pgTable, bigint, boolean, check, unique, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { junctionEntity } from '../../base.entity';
import { users } from '../../auth/users';
import { roles } from '../../rbac/roles';
import { routes } from '../../rbac/routes';

// storeFk is intentionally absent — roles already carry storeFk, so the store scope
// is encoded in the role itself. Adding storeFk here would create a mismatch
// possibility (mapping says store A, but the role belongs to store B).
export const roleRouteMapping = pgTable(
  'role_route_mapping',
  {
    ...junctionEntity(),

    roleFk: bigint('role_fk', { mode: 'number' })
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    routeFk: bigint('route_fk', { mode: 'number' })
      .notNull()
      .references(() => routes.id, { onDelete: 'cascade' }),

    allow: boolean('allow').notNull().default(true),

    // DENY flag: explicit DENY overrides any GRANT (deny-overrides-grant pattern)
    deny: boolean('deny').notNull().default(false),

    // CRUD flags
    canView: boolean('can_view').notNull().default(true),
    canCreate: boolean('can_create').notNull().default(false),
    canEdit: boolean('can_edit').notNull().default(false),
    canDelete: boolean('can_delete').notNull().default(false),
    canExport: boolean('can_export').notNull().default(false),

    assignedBy: bigint('assigned_by', { mode: 'number' }).references(
      () => users.id,
      { onDelete: 'set null' },
    ),
  },
  (table) => [
    unique('role_route_mapping_unique_idx').on(table.roleFk, table.routeFk),
    // role_fk covered by the composite unique above (leading column)
    index('role_route_mapping_route_idx').on(table.routeFk),
    check('role_route_mapping_no_allow_deny_conflict', sql`NOT (allow = true AND deny = true)`),
    // CRUD flags are meaningless when allow=false — enforce consistency.
    check(
      'role_route_mapping_crud_requires_allow',
      sql`allow = true OR (can_view = false AND can_create = false AND can_edit = false AND can_delete = false AND can_export = false)`,
    ),
  ],
);

export type RoleRouteMapping = typeof roleRouteMapping.$inferSelect;
export type NewRoleRouteMapping = typeof roleRouteMapping.$inferInsert;
export type UpdateRoleRouteMapping = Partial<Omit<NewRoleRouteMapping, 'id'>>;
