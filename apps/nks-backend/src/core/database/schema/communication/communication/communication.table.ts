import {
  pgTable,
  bigint,
  varchar,
  boolean,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { entity } from '../../entity-system/entity';
import { users } from '../../auth/users';
import { communicationType } from '../../lookups/communication-type';
import { country } from '../../location/country';
import { baseEntity, auditFields } from '../../base.entity';

/**
 * COMMUNICATION
 *
 * Polymorphic contact details storage (email, phone, fax, website) for any entity.
 * Uses soft-delete pattern: isActive (legacy) and deletedAt (preferred).
 *
 * Soft-delete strategy:
 *   - Active contacts: isActive=true AND deletedAt IS NULL
 *   - Deleted contacts: isActive=false OR deletedAt IS NOT NULL
 *   - Queries should filter: WHERE is_active = true AND deleted_at IS NULL
 *   - Historical records retained for audit/compliance purposes
 */
export const communication = pgTable(
  'communication',
  {
    ...baseEntity(), // includes: isActive, deletedAt

    // Polymorphic ownership
    entityFk: bigint('entity_fk', { mode: 'number' })
      .notNull()
      .references(() => entity.id, { onDelete: 'restrict' }),
    recordId: bigint('record_id', { mode: 'number' }).notNull(),

    // Fields
    communicationTypeFk: bigint('communication_type_fk', { mode: 'number' })
      .notNull()
      .references(() => communicationType.id, { onDelete: 'restrict' }),

    email: varchar('email', { length: 255 }),
    fax: varchar('fax', { length: 50 }),
    phoneNumber: varchar('phone_number', { length: 20 }),
    // dialCountryFk — references country.dialCode, avoiding a redundant calling_code table.
    dialCountryFk: bigint('dial_country_fk', { mode: 'number' }).references(
      () => country.id,
      { onDelete: 'restrict' },
    ),
    website: varchar('website', { length: 255 }),

    isVerified: boolean('is_verified').notNull().default(false),
    isPrimary: boolean('is_primary').notNull().default(false),

    ...auditFields(() => users.id),
  },
  (table) => [
    // isActive and deletedAt must be consistent — a row cannot be active AND soft-deleted.
    check(
      'communication_active_deleted_consistent_chk',
      sql`NOT (is_active = true AND deleted_at IS NOT NULL)`,
    ),

    // At least one contact value must be provided — a row with all nulls is useless.
    check(
      'communication_at_least_one_value_chk',
      sql`(
    email IS NOT NULL OR
    fax IS NOT NULL OR
    phone_number IS NOT NULL OR
    website IS NOT NULL
  )`,
    ),

    // Dial country only makes sense paired with a phoneNumber.
    check(
      'communication_dial_country_requires_phone_chk',
      sql`(
    dial_country_fk IS NULL OR phone_number IS NOT NULL
  )`,
    ),

    // Composite index: WHERE entity_fk = ? AND record_id = ?
    index('communication_entity_record_idx').on(table.entityFk, table.recordId),
    // Partial index: same lookup filtered to active rows only (keeps index small as data grows)
    index('communication_entity_record_active_idx')
      .on(table.entityFk, table.recordId)
      .where(sql`is_active = true`),

    // Single-column indexes for FK-only queries
    index('communication_entity_idx').on(table.entityFk),
    index('communication_record_idx').on(table.recordId),
    index('communication_type_idx').on(table.communicationTypeFk),
    index('communication_dial_country_idx').on(table.dialCountryFk),

    // Contact lookup indexes — email and phone are searched frequently
    index('communication_email_idx').on(table.email),
    index('communication_phone_idx').on(table.phoneNumber),
  ],
);

export type Communication = typeof communication.$inferSelect;
export type NewCommunication = typeof communication.$inferInsert;
export type UpdateCommunication = Partial<Omit<NewCommunication, 'id'>>;
export type PublicCommunication = Omit<
  Communication,
  'isActive' | 'deletedAt' | 'deletedBy' | 'createdBy' | 'modifiedBy'
>;
