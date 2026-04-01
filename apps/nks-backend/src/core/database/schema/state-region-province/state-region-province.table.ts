import { pgTable, varchar, bigint, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { country } from '../country';
import { users } from '../users';
import { baseEntity, auditFields } from '../base.entity';

export const stateRegionProvince = pgTable(
  'state_region_province',
  {
    ...baseEntity(),

    stateName: varchar('state_name', { length: 100 }).notNull(),
    stateCode: varchar('state_code', { length: 20 }), // e.g. 'KA', 'CA'
    description: varchar('description', { length: 255 }),

    countryFk: bigint('country_fk', { mode: 'number' })
      .notNull()
      .references(() => country.id, { onDelete: 'restrict' }),

    ...auditFields(() => users.id),
  },
  (table) => [
    // State names must be unique within their country.
    uniqueIndex('state_name_country_idx')
      .on(table.stateName, table.countryFk)
      .where(sql`deleted_at IS NULL`),
  ],
);

export type StateRegionProvince = typeof stateRegionProvince.$inferSelect;
export type NewStateRegionProvince = typeof stateRegionProvince.$inferInsert;
export type UpdateStateRegionProvince = Partial<
  Omit<NewStateRegionProvince, 'id'>
>;
export type PublicStateRegionProvince = Omit<
  StateRegionProvince,
  'isActive' | 'deletedAt' | 'deletedBy' | 'createdBy' | 'modifiedBy'
>;
