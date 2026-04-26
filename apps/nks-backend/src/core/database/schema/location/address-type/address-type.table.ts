import { pgTable, varchar, text, boolean } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Address Type Lookup
 * Defines address classification (Home, Office, Billing, Shipping, Warehouse, etc.)
 */
export const addressType = pgTable('address_type', {
  ...baseEntity(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  label: varchar('label', { length: 100 }).notNull(),
  description: text('description'),
  isShippingApplicable: boolean('is_shipping_applicable').notNull().default(true),
  ...auditFields(() => users.id),
});

export type AddressType = typeof addressType.$inferSelect;
export type NewAddressType = typeof addressType.$inferInsert;
