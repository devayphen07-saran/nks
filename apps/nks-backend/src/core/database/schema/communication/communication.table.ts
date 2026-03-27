import {
  pgTable,
  bigint,
  varchar,
  boolean,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { entity } from '../entity';
import { users } from '../users';
import { communicationType } from '../communication-type';
import { country } from '../country';
import { baseEntity, auditFields } from '../base.entity';

export const communication = pgTable(
  'communication',
  {
    ...baseEntity(),

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
  ],
);

export type Communication = typeof communication.$inferSelect;
export type NewCommunication = typeof communication.$inferInsert;
export type UpdateCommunication = Partial<Omit<NewCommunication, 'id'>>;
export type PublicCommunication = Omit<
  Communication,
  'isActive' | 'deletedAt' | 'deletedBy' | 'createdBy' | 'modifiedBy'
>;
