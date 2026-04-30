import { pgTable, varchar, text, integer } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Designation Type Lookup
 * Staff designations (Manager, Cashier, Accountant, Supervisor, Delivery Executive)
 *
 * ⚠ DO NOT CONSOLIDATE INTO `lookup` TABLE.
 * Reason: `department` (org grouping) and `reporting_level` (1=director,
 *   2=manager, 3=executive — used for hierarchy queries and approval routing)
 *   are business columns that cannot live in the generic (code, label,
 *   description) shape of `lookup`.
 * Registered in `lookup_type` with has_table=true for catalog discoverability.
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
