import { pgTable, varchar, text } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Contact Person Type Lookup
 * Role/relationship of contact person (Owner, Authorized Signatory, Manager, Account Lead)
 */
export const contactPersonType = pgTable('contact_person_type', {
  ...baseEntity(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  label: varchar('label', { length: 100 }).notNull(),
  description: text('description'),
  ...auditFields(() => users.id),
});

export type ContactPersonType = typeof contactPersonType.$inferSelect;
export type NewContactPersonType = typeof contactPersonType.$inferInsert;
