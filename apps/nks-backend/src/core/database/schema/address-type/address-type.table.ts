import { pgTable, varchar, text } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../base.entity';
import { users } from '../users';

export const addressType = pgTable('address_type', {
  ...baseEntity(),

  addressTypeName: varchar('address_type_name', { length: 50 })
    .notNull()
    .unique(), // e.g. 'Home', 'Office', 'Shipping', 'Billing'
  addressTypeCode: varchar('address_type_code', { length: 30 })
    .notNull()
    .unique(), // e.g. 'HOME', 'OFFICE', 'SHIPPING', 'BILLING'
  description: text('description'),

  ...auditFields(() => users.id),
});

export type AddressType = typeof addressType.$inferSelect;
export type NewAddressType = typeof addressType.$inferInsert;
export type UpdateAddressType = Partial<Omit<NewAddressType, 'id'>>;
