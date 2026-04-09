import { pgTable, varchar, text, integer } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Tax Filing Frequency Lookup
 * GST return filing frequency (Monthly, Quarterly, Half-Yearly, Annual)
 * Replaces hardcoded enum: filingFrequencyEnum
 */
export const taxFilingFrequency = pgTable('tax_filing_frequency', {
  ...baseEntity(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  label: varchar('label', { length: 100 }).notNull(),
  description: text('description'),
  filingDays: integer('filing_days').notNull(), // 30, 90, 180, 365
  ...auditFields(() => users.id),
});

export type TaxFilingFrequency = typeof taxFilingFrequency.$inferSelect;
export type NewTaxFilingFrequency = typeof taxFilingFrequency.$inferInsert;
