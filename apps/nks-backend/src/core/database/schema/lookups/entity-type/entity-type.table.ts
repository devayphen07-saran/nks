import { pgTable, varchar, text, bigint, boolean } from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Entity Type Lookup
 * Entity codes for role-based entity permissions (Invoice, Product, Purchase Order, Report, etc.)
 * Used as the FK target in role_permissions and entity_status_mapping.
 *
 * parentEntityTypeFk: optional grouping parent (e.g. FINANCE → INVOICE, CREDIT_NOTE).
 *   Used to render a hierarchical permission tree in the UI editor.
 *   NULL means this entity is a top-level root.
 *
 * defaultAllow: when true, all users implicitly have VIEW access to this entity
 *   even without an explicit role_permissions row. Used for publicly-readable
 *   reference data (e.g. country list, currency codes) — avoids seeding
 *   permission rows for every role.
 */
export const entityType = pgTable('entity_type', {
  ...baseEntity(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  label: varchar('label', { length: 100 }).notNull(),
  description: text('description'),
  parentEntityTypeFk: bigint('parent_entity_type_fk', { mode: 'number' })
    .references((): AnyPgColumn => entityType.id, { onDelete: 'set null' }),
  defaultAllow: boolean('default_allow').notNull().default(false),
  ...auditFields(() => users.id),
});

export type EntityType = typeof entityType.$inferSelect;
export type NewEntityType = typeof entityType.$inferInsert;
