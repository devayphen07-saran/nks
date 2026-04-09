import { pgTable, varchar, text, integer } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Designation Type Lookup
 * Staff designations (Manager, Cashier, Accountant, Supervisor, Delivery Executive)
 */
export const designationType = pgTable('designation_type', {
  ...baseEntity(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  label: varchar('label', { length: 100 }).notNull(),
  description: text('description'),
  department: varchar('department', { length: 50 }),
  reportingLevel: integer('reporting_level'), // 1=director, 2=manager, 3=executive
  ...auditFields(() => users.id),
});

export type DesignationType = typeof designationType.$inferSelect;
export type NewDesignationType = typeof designationType.$inferInsert;
