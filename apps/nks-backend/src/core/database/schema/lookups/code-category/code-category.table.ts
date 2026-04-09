import { pgTable, varchar, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Master category table — defines the type of reference data.
 *
 * Examples: SALUTATION, ADDRESS_TYPE, STORE_LEGAL_TYPE, STORE_CATEGORY, DESIGNATION
 *
 * is_system = true  → seeded by the platform, cannot be deleted via API
 * is_system = false → created by platform admin, deletable if no values exist
 */
export const codeCategory = pgTable(
  'code_category',
  {
    ...baseEntity(),

    code: varchar('code', { length: 50 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    description: varchar('description', { length: 255 }),

    ...auditFields(() => users.id),
  },
  (table) => [
    uniqueIndex('code_category_code_idx')
      .on(table.code)
      .where(sql`deleted_at IS NULL`),
  ],
);

export type CodeCategory    = typeof codeCategory.$inferSelect;
export type NewCodeCategory = typeof codeCategory.$inferInsert;
