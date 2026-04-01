import {
  pgTable,
  varchar,
  text,
  bigint,
  boolean,
  index,
  uniqueIndex,
  PgTableWithColumns,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntity, auditFields } from '../base.entity';
import { users } from '../users';

/**
 * ApplicationEntity represents modules/features in the application
 * Examples: Customers, Suppliers, Products, Accounting, Reports
 * Each entity can have:
 * - CRUD permissions (view, create, edit, delete)
 * - Custom status workflows
 * - Audit trails
 * - Role-based access control
 */
export const applicationEntity: PgTableWithColumns<{
  name: 'application_entity';
  schema: undefined;
  columns: any;
  dialect: 'pg';
}> = pgTable(
  'application_entity',
  {
    ...baseEntity(),

    // Unique code within the system (e.g., 'customers', 'suppliers')
    code: varchar('code', { length: 50 }).notNull(),
    // Display name (e.g., 'Customer Management')
    name: varchar('name', { length: 100 }).notNull(),
    // Description of what this entity manages
    description: text('description'),

    // Parent entity for hierarchical structure
    // E.g., 'CustomerPayment' parent could be 'Customers'
    parentEntityFk: bigint('parent_entity_fk', { mode: 'number' }).references(
      () => applicationEntity.id,
      { onDelete: 'set null' },
    ),

    // Icon name for UI display (e.g., 'Users', 'Building2')
    iconName: varchar('icon_name', { length: 50 }),

    // Route path for navigation (e.g., '/customers', '/suppliers')
    routePath: varchar('route_path', { length: 100 }),

    // Database table name linked to this entity
    mainTableName: varchar('main_table_name', { length: 100 }),

    // Primary key field of the linked table
    primaryKeyField: varchar('primary_key_field', { length: 50 }),

    // Whether this entity has audit trail enabled
    isAuditEnabled: boolean('is_audit_enabled').default(false),

    // Audit profile type (e.g., 'FULL', 'BASIC')
    auditProfile: varchar('audit_profile', { length: 50 }),

    // Whether permissions should be checked for this entity
    requiresPermission: boolean('requires_permission').default(true),

    // Display/sorting
    sortOrder: bigint('sort_order', { mode: 'number' }).default(0),
    isHidden: boolean('is_hidden').default(false),

    ...auditFields(() => users.id),
  },
  (table) => [
    // Code must be unique within non-deleted records
    uniqueIndex('application_entity_code_idx')
      .on(table.code)
      .where(sql`deleted_at IS NULL`),

    // Reverse lookup by parent
    index('application_entity_parent_fk_idx').on(table.parentEntityFk),

    // Route-based lookup
    index('application_entity_route_path_idx').on(table.routePath),
  ],
);

export type ApplicationEntity = typeof applicationEntity.$inferSelect;
export type NewApplicationEntity = typeof applicationEntity.$inferInsert;
export type UpdateApplicationEntity = Partial<Omit<NewApplicationEntity, 'id'>>;
