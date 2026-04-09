import { pgTable, varchar, text } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Tax Registration Type Lookup
 * GST registration modes (Regular, Composition, Exempt, SEZ, Special)
 * Replaces hardcoded enum: registrationTypeEnum
 */
export const taxRegistrationType = pgTable('tax_registration_type', {
  ...baseEntity(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  label: varchar('label', { length: 100 }).notNull(),
  description: text('description'),
  ...auditFields(() => users.id),
});

export type TaxRegistrationType = typeof taxRegistrationType.$inferSelect;
export type NewTaxRegistrationType = typeof taxRegistrationType.$inferInsert;
