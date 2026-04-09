import { pgTable, varchar, text } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Tax Line Status Lookup
 * Transaction tax line approval statuses (Pending, Approved, Rejected, Under Review)
 */
export const taxLineStatus = pgTable('tax_line_status', {
  ...baseEntity(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  label: varchar('label', { length: 100 }).notNull(),
  description: text('description'),
  ...auditFields(() => users.id),
});

export type TaxLineStatus = typeof taxLineStatus.$inferSelect;
export type NewTaxLineStatus = typeof taxLineStatus.$inferInsert;
