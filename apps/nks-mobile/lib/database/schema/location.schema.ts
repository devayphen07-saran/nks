import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const state = sqliteTable(
  'state',
  {
    id:                 integer('id').primaryKey(),
    guuid:              text('guuid').notNull().unique(),
    state_name:         text('state_name').notNull(),
    state_code:         text('state_code').notNull(),  // 'KA', 'MH'
    gst_state_code:     text('gst_state_code'),        // '29', '27'
    is_union_territory: integer('is_union_territory').notNull().default(0),
    is_active:          integer('is_active').notNull().default(1),
    updated_at:         text('updated_at').notNull(),
    deleted_at:         text('deleted_at'),
  },
  (t) => [
    index('idx_state_code').on(t.state_code),
  ],
);

export const district = sqliteTable(
  'district',
  {
    id:            integer('id').primaryKey(),
    guuid:         text('guuid').notNull().unique(),
    district_name: text('district_name').notNull(),
    district_code: text('district_code'),
    lgd_code:      text('lgd_code'),    // Local Government Directory code
    state_fk:      integer('state_fk').notNull(),
    is_active:     integer('is_active').notNull().default(1),
    updated_at:    text('updated_at').notNull(),
    deleted_at:    text('deleted_at'),
  },
  (t) => [
    index('idx_district_state_fk').on(t.state_fk),
  ],
);

export type StateRow    = typeof state.$inferSelect;
export type DistrictRow = typeof district.$inferSelect;
