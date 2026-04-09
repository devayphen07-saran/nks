import { pgTable, varchar, bigint, boolean, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';
import { store } from '../../store/store';

export const roles = pgTable(
  'roles',
  {
    ...baseEntity(),

    // Role code: unique identifier for the role
    // System roles: SUPER_ADMIN (global)
    // Custom roles: MANAGER, CASHIER, etc. (store-scoped)
    code: varchar('code', { length: 30 }).notNull(),
    roleName: varchar('role_name', { length: 50 }).notNull(),
    description: varchar('description', { length: 250 }),

    // Store scope: nullable for system roles, required for custom roles
    storeFk: bigint('store_fk', { mode: 'number' })
      .references(() => store.id, {
        onDelete: 'restrict',
      }),

    // System role flag: true for SUPER_ADMIN, false for custom roles
    // System roles: isSystem=true, isEditable=false, storeFk=NULL
    // Custom roles: isSystem=false, isEditable=true, storeFk=<storeId>
    isSystem: boolean('is_system').notNull().default(false),
    isEditable: boolean('is_editable').notNull().default(true),

    ...auditFields(() => users.id),
  },
  (table) => [
    // Code must be unique within each store (custom roles) or globally (system roles)
    uniqueIndex('roles_code_store_idx')
      .on(table.code, table.storeFk)
      .where(sql`deleted_at IS NULL AND store_fk IS NOT NULL`),

    // Role name must be unique within each store (custom roles)
    uniqueIndex('roles_name_store_idx')
      .on(table.roleName, table.storeFk)
      .where(sql`deleted_at IS NULL AND store_fk IS NOT NULL`),

    // Code must be globally unique for system roles (where store_fk IS NULL)
    uniqueIndex('roles_code_global_idx')
      .on(table.code)
      .where(sql`deleted_at IS NULL AND store_fk IS NULL`),

    // Index for finding all custom roles in a store
    index('roles_store_idx').on(table.storeFk),
    index('roles_is_system_idx').on(table.isSystem),
  ],
);

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type UpdateRole = Partial<Omit<NewRole, 'id'>>;

// System role codes that are reserved and cannot be used for custom roles
export type SystemRoleCode = 'SUPER_ADMIN';
export const SYSTEM_ROLE_CODES = ['SUPER_ADMIN'] as const;
