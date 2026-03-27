import { pgTable, bigint, boolean, unique, index } from 'drizzle-orm/pg-core';
import { junctionEntity } from '../base.entity';
import { users } from '../users';
import { roles } from '../roles';
import { routes } from '../routes';

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
  ],
);

export type RoleRouteMapping = typeof roleRouteMapping.$inferSelect;
export type NewRoleRouteMapping = typeof roleRouteMapping.$inferInsert;
export type UpdateRoleRouteMapping = Partial<Omit<NewRoleRouteMapping, 'id'>>;
