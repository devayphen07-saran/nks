import {
  pgTable,
  bigint,
  boolean,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { roles } from '../../rbac/roles';
import { entityType } from '../../lookups/entity-type';
import { baseEntity } from '../../base.entity';

/**
 * Role Entity Permission Mapping
 *
 * Provides granular permission control per entity type per role.
 * Each role can have different permission levels for different entity types.
 *
 * Example:
 * - Manager role on Invoice entity: can VIEW, CREATE, EDIT (but not DELETE)
 * - Manager role on Product entity: can only VIEW
 * - Manager role on Report entity: can VIEW, CREATE
 */
export const roleEntityPermission = pgTable(
  'role_entity_permission',
  {
    ...baseEntity(),

    // Reference to the role
    roleFk: bigint('role_fk', { mode: 'number' })
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),

    // Entity type (e.g., 'INVOICE', 'PRODUCT', 'PURCHASE_ORDER', 'REPORT')
    // FK to entity_type lookup table for data integrity and extensibility
    entityTypeFk: bigint('entity_type_fk', { mode: 'number' })
      .notNull()
      .references(() => entityType.id, { onDelete: 'restrict' }),

    // Granular permission flags
    canView: boolean('can_view').notNull().default(false),
    canCreate: boolean('can_create').notNull().default(false),
    canEdit: boolean('can_edit').notNull().default(false),
    canDelete: boolean('can_delete').notNull().default(false),

    // DENY flag: explicit DENY overrides any GRANT (deny-overrides-grant pattern)
    // If true, this role is EXPLICITLY DENIED the permission, even if another role grants it
    deny: boolean('deny').notNull().default(false),
  },
  (table) => [
    unique('role_entity_permission_unique_idx').on(
      table.roleFk,
      table.entityTypeFk,
    ),
    // Composite index for most common queries (role + entity lookup)
    index('role_entity_permission_role_entity_idx').on(
      table.roleFk,
      table.entityTypeFk,
    ),
    // Frequently queried by role
    index('role_entity_permission_role_idx').on(table.roleFk),
    // Frequently queried by entity type
    index('role_entity_permission_entity_idx').on(table.entityTypeFk),
    // Active permissions only
    index('role_entity_permission_active_idx').on(table.isActive),
  ],
);

export type RoleEntityPermission = typeof roleEntityPermission.$inferSelect;
export type NewRoleEntityPermission = typeof roleEntityPermission.$inferInsert;
export type UpdateRoleEntityPermission = Partial<
  Omit<NewRoleEntityPermission, 'id'>
>;
