import {
  pgTable,
  varchar,
  bigint,
  boolean,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { stateRegionProvince } from '../state-region-province';
import { users } from '../users';
import { baseEntity, auditFields } from '../base.entity';

export const district = pgTable(
  'district',
  {
    ...baseEntity(),

    districtName: varchar('district_name', { length: 100 }).notNull(),
    districtCode: varchar('district_code', { length: 20 }),
    description: varchar('description', { length: 255 }),

    stateRegionProvinceFk: bigint('state_region_province_fk', {
      mode: 'number',
    })
      .notNull()
      .references(() => stateRegionProvince.id, { onDelete: 'restrict' }),

    ...auditFields(() => users.id),
  },
  (table) => [
    // District names must be unique within their state.
    uniqueIndex('district_name_state_idx')
      .on(table.districtName, table.stateRegionProvinceFk)
      .where(sql`deleted_at IS NULL`),
  ],
);

export type District = typeof district.$inferSelect;
export type NewDistrict = typeof district.$inferInsert;
export type UpdateDistrict = Partial<Omit<NewDistrict, 'id'>>;
export type PublicDistrict = Omit<
  District,
  'isActive' | 'deletedAt' | 'deletedBy' | 'createdBy' | 'modifiedBy'
>;
