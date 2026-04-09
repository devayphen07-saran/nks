import { pgTable, varchar, text } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Store Legal Type Lookup
 * Defines legal structures for stores (India: PVT_LTD, SOLE_PROP, etc.)
 */
export const storeLegalType = pgTable('store_legal_type', {
  ...baseEntity(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  label: varchar('label', { length: 100 }).notNull(),
  description: text('description'),
  ...auditFields(() => users.id),
});

export type StoreLegalType = typeof storeLegalType.$inferSelect;
export type NewStoreLegalType = typeof storeLegalType.$inferInsert;
