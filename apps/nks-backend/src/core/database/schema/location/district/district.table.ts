import { pgTable, varchar, bigint, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '../../auth/users';
import { baseEntity, auditFields } from '../../base.entity';
import { state } from '../../location/state/state.table';

/**
 * DISTRICT
 *
 * India-Specific Location Table
 *
 * Simplified, India-focused alternative to administrative_division.
 * Contains ~766 districts across all Indian states/UTs.
 *
 * Key differences from administrative_division:
 * - Only has stateFk (no countryFk, as this is India-only)
 * - Includes lgdCode (Local Government Directory code from census)
 *
 * No countryFk needed since this is India-only.
 */
export const district = pgTable(
  'district',
  {
    ...baseEntity(),

    districtName: varchar('district_name', { length: 100 }).notNull(),
    districtCode: varchar('district_code', { length: 20 }),

    // India-specific: Census LGD (Local Government Directory) code
    lgdCode: varchar('lgd_code', { length: 10 }),

    // FK to state (no countryFk; state table is India-only)
    stateFk: bigint('state_fk', { mode: 'number' })
      .notNull()
      .references(() => state.id, { onDelete: 'restrict' }),

    description: varchar('description', { length: 255 }),

    ...auditFields(() => users.id),
  },
  (table) => [
    uniqueIndex('district_name_state_idx')
      .on(table.districtName, table.stateFk)
      .where(sql`deleted_at IS NULL`),
    index('district_state_idx').on(table.stateFk),
  ],
);

export type District = typeof district.$inferSelect;
export type NewDistrict = typeof district.$inferInsert;
export type UpdateDistrict = Partial<Omit<NewDistrict, 'id'>>;
export type PublicDistrict = Omit<
  District,
  'isActive' | 'deletedAt' | 'deletedBy' | 'createdBy' | 'modifiedBy'
>;
