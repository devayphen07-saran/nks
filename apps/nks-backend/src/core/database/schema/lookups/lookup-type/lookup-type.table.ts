import { pgTable, varchar, boolean, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * lookup_type — registry of all lookup categories.
 *
 * has_table = false → values live in the generic `lookup` table (standard code/label/description)
 * has_table = true  → values live in a dedicated table with domain-specific columns
 *                     (billing_frequency.days, address_type.is_shipping_applicable, etc.)
 *
 * is_custom_table = true → lookup type was created by platform admin at runtime (not seeded)
 */
export const lookupType = pgTable(
  'lookup_type',
  {
    ...baseEntity(),

    code:        varchar('code',        { length: 50  }).notNull(),
    title:       varchar('title',       { length: 100 }).notNull(),
    description: varchar('description', { length: 255 }),

    // false → values are rows in the lookup table
    // true  → values live in a dedicated table (e.g. billing_frequency)
    hasTable: boolean('has_table').notNull().default(false),

    // true → created at runtime by admin; false → seeded by platform
    isCustomTable: boolean('is_custom_table').notNull().default(false),

    ...auditFields(() => users.id),
  },
  (table) => [
    uniqueIndex('lookup_type_code_idx')
      .on(table.code)
      .where(sql`deleted_at IS NULL`),
  ],
);

export type LookupType    = typeof lookupType.$inferSelect;
export type NewLookupType = typeof lookupType.$inferInsert;
export type UpdateLookupType = Partial<Omit<NewLookupType, 'id'>>;
