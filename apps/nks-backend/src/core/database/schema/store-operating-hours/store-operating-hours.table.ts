import {
  pgTable,
  bigint,
  smallint,
  time,
  boolean,
  varchar,
  index,
  unique,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '../users';
import { store } from '../store';
import { baseEntity, auditFields } from '../base.entity';

/**
 * STORE_OPERATING_HOURS
 *
 * Unified table replacing store_business_hours and store_shift.
 * Supports multiple shifts per day while maintaining simple single-shift cases.
 *
 * Design:
 *   - One row per store+day+shift combination
 *   - shiftNumber allows multiple shifts (defaults to 1)
 *   - shiftName optional for display (Morning, Evening, Night)
 *   - isClosed flag allows marking entire day as closed
 *   - Time validation: if closed, times optional; if open, times required and opening < closing
 *
 * Migration from old tables:
 *   - store_business_hours → mapped to shift_number=1, shiftName=NULL
 *   - store_shift → mapped directly with shiftNumber and shiftName
 */
export const storeOperatingHours = pgTable(
  'store_operating_hours',
  {
    ...baseEntity(),

    // Reference to store
    storeFk: bigint('store_fk', { mode: 'number' })
      .notNull()
      .references(() => store.id, { onDelete: 'cascade' }),

    // Day of week: 0 = Monday, 1 = Tuesday, ..., 6 = Sunday
    dayOfWeek: smallint('day_of_week').notNull(),

    // Shift sequence number for the day (1st shift, 2nd shift, etc.)
    // Allows multiple shifts on the same day
    shiftNumber: smallint('shift_number').notNull().default(1),

    // Optional shift name for display (e.g., "Morning", "Evening", "Night")
    shiftName: varchar('shift_name', { length: 50 }),

    // Opening time (e.g., 09:00)
    // NULL only when isClosed=true
    openingTime: time('opening_time'),

    // Closing time (e.g., 21:00)
    // NULL only when isClosed=true
    closingTime: time('closing_time'),

    // Flag to mark as holiday/closed day
    isClosed: boolean('is_closed').notNull().default(false),

    ...auditFields(() => users.id),
  },
  (table) => [
    // Ensure unique shift per day per store
    unique('store_operating_hours_unique_idx').on(
      table.storeFk,
      table.dayOfWeek,
      table.shiftNumber,
    ),

    // Validate time consistency: if closed, both times NULL; if open, both present and valid
    check(
      'store_operating_hours_time_validity_chk',
      sql`
        (is_closed = true AND opening_time IS NULL AND closing_time IS NULL)
        OR
        (is_closed = false AND opening_time IS NOT NULL AND closing_time IS NOT NULL AND opening_time < closing_time)
      `,
    ),

    // Indexes for common queries
    index('store_operating_hours_store_idx').on(table.storeFk),
    index('store_operating_hours_day_idx').on(table.dayOfWeek),
    index('store_operating_hours_store_day_idx').on(
      table.storeFk,
      table.dayOfWeek,
    ),
    index('store_operating_hours_closed_idx').on(table.isClosed),
  ],
);

export type StoreOperatingHours = typeof storeOperatingHours.$inferSelect;
export type NewStoreOperatingHours = typeof storeOperatingHours.$inferInsert;
export type UpdateStoreOperatingHours = Partial<
  Omit<NewStoreOperatingHours, 'id'>
>;
