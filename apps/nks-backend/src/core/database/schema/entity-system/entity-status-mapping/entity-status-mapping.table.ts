import { pgTable, bigint, varchar, boolean, unique, index } from 'drizzle-orm/pg-core';
import { junctionEntity } from '../../base.entity';
import { status } from '../../entity-system/status';

/**
 * entity_status_mapping
 *
 * Defines which statuses are valid for a given entity type.
 * entityCode is a plain string (e.g. 'orders', 'invoices') — consistent
 * with how role_entity_permission.entity_code works in this codebase.
 *
 * Examples:
 *   orders    → DFT, APRV, CMPL, CNL, DECL
 *   invoices  → DFT, APRV, CMPL, EXP
 *   stores    → DFT, APRV, DECL, ARCH
 */
export const entityStatusMapping = pgTable(
  'entity_status_mapping',
  {
    ...junctionEntity(),

    entityCode: varchar('entity_code', { length: 50 }).notNull(),

    statusFk: bigint('status_fk', { mode: 'number' })
      .notNull()
      .references(() => status.id, { onDelete: 'cascade' }),

    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    unique('entity_status_mapping_unique_idx').on(table.entityCode, table.statusFk),
    index('entity_status_mapping_entity_idx').on(table.entityCode),
    index('entity_status_mapping_status_idx').on(table.statusFk),
  ],
);

export type EntityStatusMapping    = typeof entityStatusMapping.$inferSelect;
export type NewEntityStatusMapping = typeof entityStatusMapping.$inferInsert;
