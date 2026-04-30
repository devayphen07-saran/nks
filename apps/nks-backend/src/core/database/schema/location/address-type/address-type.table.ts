import { pgTable, varchar, text, boolean } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Address Type Lookup
 * Defines address classification (Home, Office, Billing, Shipping, Warehouse, etc.)
 *
 * ⚠ DO NOT CONSOLIDATE INTO `lookup` TABLE.
 * Reason: `is_shipping_applicable` is a business flag used to filter address
 *   types when collecting shipping vs billing addresses. Cannot be represented
 *   in the generic (code, label, description) shape of `lookup`.
 * Registered in `lookup_type` with has_table=true for catalog discoverability.
 * Confirmed against Ayphen reference (2026-04-30): AddressType also dedicated.
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
