import {
  pgTable,
  bigint,
  varchar,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { entity } from '../../entity-system/entity';
import { users } from '../../auth/users';
import { state } from '../../location/state';
import { district } from '../../location/district';
import { pincode } from '../../location/pincode';
import { addressType } from '../../location/address-type/address-type.table';
import { baseEntity, auditFields } from '../../base.entity';

/**
 * ADDRESS
 *
 * Polymorphic address storage for any entity (customer, vendor, store, etc.)
 * India-only. Location resolved via state/district/pincode FK references.
 * addressTypeFk references code_value (ADDRESS_TYPE category).
 */
export const address = pgTable(
  'address',
  {
    ...baseEntity(),

    // Polymorphic ownership
    entityFk: bigint('entity_fk', { mode: 'number' })
      .notNull()
      .references(() => entity.id, { onDelete: 'restrict' }),
    recordId: bigint('record_id', { mode: 'number' }).notNull(),

    // Address type (HOME, OFFICE, BILLING, SHIPPING, WAREHOUSE, REGISTERED_OFFICE, etc.)
    // NORMALIZED: Dedicated table instead of code_value pattern
    addressTypeFk: bigint('address_type_fk', { mode: 'number' })
      .notNull()
      .references(() => addressType.id, { onDelete: 'restrict' }),

    line1: varchar('line1', { length: 255 }).notNull(),
    line2: varchar('line2', { length: 255 }),
    cityName: varchar('city_name', { length: 150 }).notNull(), // ← FIXED: address is incomplete without city

    // India-specific location FKs (replaces text fields)
    stateFk: bigint('state_fk', { mode: 'number' })
      .references(() => state.id, { onDelete: 'restrict' }),
    districtFk: bigint('district_fk', { mode: 'number' })
      .references(() => district.id, { onDelete: 'restrict' }),
    pincodeFk: bigint('pincode_fk', { mode: 'number' })
      .references(() => pincode.id, { onDelete: 'restrict' }),

    isBillingAddress: boolean('is_billing_address').notNull().default(false),
    isDefaultAddress: boolean('is_default_address').notNull().default(false),

    ...auditFields(() => users.id),
  },
  (table) => [
    index('address_entity_record_idx').on(table.entityFk, table.recordId),
    // Composite for "find billing/shipping address for entity X" queries
    index('address_entity_type_idx').on(table.entityFk, table.addressTypeFk),
    index('address_entity_record_active_idx')
      .on(table.entityFk, table.recordId)
      .where(sql`is_active = true`),
    index('address_entity_idx').on(table.entityFk),
    index('address_record_idx').on(table.recordId),
    index('address_type_idx').on(table.addressTypeFk),
    index('address_state_idx').on(table.stateFk),
    index('address_district_idx').on(table.districtFk),
    index('address_pincode_idx').on(table.pincodeFk),

    uniqueIndex('address_one_default_idx')
      .on(table.entityFk, table.recordId)
      .where(sql`is_default_address = true AND deleted_at IS NULL`),
    uniqueIndex('address_one_billing_idx')
      .on(table.entityFk, table.recordId)
      .where(sql`is_billing_address = true AND deleted_at IS NULL`),
  ],
);

export type Address = typeof address.$inferSelect;
export type NewAddress = typeof address.$inferInsert;
export type UpdateAddress = Partial<Omit<NewAddress, 'id'>>;
export type PublicAddress = Omit<
  Address,
  'isActive' | 'deletedAt' | 'deletedBy' | 'createdBy' | 'modifiedBy'
>;
