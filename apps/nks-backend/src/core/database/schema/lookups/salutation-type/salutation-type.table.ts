import { pgTable, varchar, text } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Salutation Type Lookup
 * Name prefixes/titles (Mr, Mrs, Ms, Dr, Prof, Hon, Rev, Imam, Sri, Shri, Srimati)
 */
export const salutationType = pgTable('salutation_type', {
  ...baseEntity(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  label: varchar('label', { length: 100 }).notNull(),
  description: text('description'),
  ...auditFields(() => users.id),
});

export type SalutationType = typeof salutationType.$inferSelect;
export type NewSalutationType = typeof salutationType.$inferInsert;
