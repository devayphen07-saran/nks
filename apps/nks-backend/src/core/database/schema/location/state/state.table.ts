import { pgTable, varchar, boolean, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '../../auth/users';
import { baseEntity, auditFields } from '../../base.entity';

/**
 * STATE
 *
 * India-Specific Location Table
 *
 * Simplified, India-focused alternative to state_region_province.
 * Contains all 28 states and 8 Union Territories with India-specific fields:
 * - gstStateCode: 2-digit GST registration prefix (01-37)
 * - isUnionTerritory: Boolean flag for Union Territories vs States
 *
 * No countryFk needed since this is India-only.
 */
export const state = pgTable(
  'state',
  {
    ...baseEntity(),

    stateName: varchar('state_name', { length: 100 }).notNull(),
    stateCode: varchar('state_code', { length: 10 }).notNull(), // e.g. 'KA' (Karnataka), 'MH' (Maharashtra)

    // India-specific: GST state code (2-digit prefix for GSTIN registration)
    // 01-28 for states, 29-37 for Union Territories
    gstStateCode: varchar('gst_state_code', { length: 2 }),

    // India-specific: Union Territory flag
    isUnionTerritory: boolean('is_union_territory').notNull().default(false),

    description: varchar('description', { length: 255 }),

    ...auditFields(() => users.id),
  },
  (table) => [
    uniqueIndex('state_name_idx')
      .on(table.stateName)
      .where(sql`deleted_at IS NULL`),
    uniqueIndex('state_code_idx')
      .on(table.stateCode)
      .where(sql`deleted_at IS NULL`),
  ],
);

export type State = typeof state.$inferSelect;
export type NewState = typeof state.$inferInsert;
export type UpdateState = Partial<Omit<NewState, 'id'>>;
export type PublicState = Omit<
  State,
  'isActive' | 'deletedAt' | 'deletedBy' | 'createdBy' | 'modifiedBy'
>;
