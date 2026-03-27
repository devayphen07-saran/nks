import {
  pgTable,
  bigint,
  varchar,
  boolean,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { entity } from '../entity';
import { users } from '../users';
import { country } from '../country';
import { addressType } from '../address-type';
import { stateRegionProvince } from '../state-region-province';
import { district } from '../district';
import { baseEntity, auditFields } from '../base.entity';

export const address = pgTable(
  'address',
  {
    ...baseEntity(),

    // Polymorphic ownership
    entityFk: bigint('entity_fk', { mode: 'number' })
      .notNull()
      .references(() => entity.id, { onDelete: 'restrict' }),
    recordId: bigint('record_id', { mode: 'number' }).notNull(),

    // Fields
    addressTypeFk: bigint('address_type_fk', { mode: 'number' })
      .notNull()
      .references(() => addressType.id, { onDelete: 'restrict' }),
    line1: varchar('line1', { length: 255 }).notNull(),
    line2: varchar('line2', { length: 255 }),

    // Metadata fields
    cityName: varchar('city_name', { length: 150 }),
    stateRegionProvinceFk: bigint('state_region_province_fk', {
      mode: 'number',
    }).references(() => stateRegionProvince.id, { onDelete: 'restrict' }),
    stateRegionProvinceText: varchar('state_region_province_text', {
      length: 100,
    }),
    districtFk: bigint('district_fk', { mode: 'number' }).references(
      () => district.id,
      { onDelete: 'restrict' },
    ),
    districtText: varchar('district_text', { length: 100 }),

    postalCode: varchar('postal_code', { length: 20 }),

    // countryFk — NOT NULL: an address without a country is geographically ambiguous.
    // Postal codes, states, and cities all resolve within a country context.
    countryFk: bigint('country_fk', { mode: 'number' })
      .notNull()
      .references(() => country.id, { onDelete: 'restrict' }),

    isBillingAddress: boolean('is_billing_address').notNull().default(false),
    isDefaultAddress: boolean('is_default_address').notNull().default(false),

    ...auditFields(() => users.id),
  },
  (table) => [
    // Composite index: WHERE entity_fk = ? AND record_id = ?
    index('address_entity_record_idx').on(table.entityFk, table.recordId),
    // Partial index: same lookup filtered to active rows only
    index('address_entity_record_active_idx')
      .on(table.entityFk, table.recordId)
      .where(sql`is_active = true`),

    // Only one default address and one billing address per record.
    uniqueIndex('address_one_default_idx')
      .on(table.entityFk, table.recordId)
      .where(sql`is_default_address = true AND deleted_at IS NULL`),
    uniqueIndex('address_one_billing_idx')
      .on(table.entityFk, table.recordId)
      .where(sql`is_billing_address = true AND deleted_at IS NULL`),

    // FK/text pairs are mutually exclusive — set FK when the row exists in geography tables,
    // or set text for custom/unrecognised values. Never both simultaneously.
    check(
      'address_state_fk_or_text_chk',
      sql`state_region_province_fk IS NULL OR state_region_province_text IS NULL`,
    ),
    check(
      'address_district_fk_or_text_chk',
      sql`district_fk IS NULL OR district_text IS NULL`,
    ),
  ],
);

export type Address = typeof address.$inferSelect;
export type NewAddress = typeof address.$inferInsert;
export type UpdateAddress = Partial<Omit<NewAddress, 'id'>>;
export type PublicAddress = Omit<
  Address,
  'isActive' | 'deletedAt' | 'deletedBy' | 'createdBy' | 'modifiedBy'
>;
