import { pgTable, varchar, text } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Entity Type Lookup
 * Entity codes for role-based entity permissions (Invoice, Product, Purchase Order, Report, etc.)
 * Replaces magic strings in role_entity_permission.entityCode
 */
export const entityType = pgTable('entity_type', {
  ...baseEntity(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  label: varchar('label', { length: 100 }).notNull(),
  description: text('description'),
  ...auditFields(() => users.id),
});

export type EntityType = typeof entityType.$inferSelect;
export type NewEntityType = typeof entityType.$inferInsert;
