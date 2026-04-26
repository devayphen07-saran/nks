import {
  pgTable,
  bigint,
  varchar,
  boolean,
  check,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { entity } from '../../entity-system/entity';
import { users } from '../../auth/users';
import { contactPersonType } from '../../lookups/contact-person-type/contact-person-type.table';
import { salutationType } from '../../lookups/salutation-type/salutation-type.table';
import { designationType } from '../../lookups/designation-type/designation-type.table';
import { baseEntity, auditFields } from '../../base.entity';

/**
 * CONTACT_PERSON
 *
 * Polymorphic contact person registry for any entity (customer, vendor, store, etc.)
 * Uses soft-delete pattern: isActive (legacy) and deletedAt (preferred).
 *
 * Soft-delete strategy:
 *   - Active contacts: isActive=true AND deletedAt IS NULL
 *   - Deleted contacts: isActive=false OR deletedAt IS NOT NULL
 *   - Queries should filter: WHERE is_active = true AND deleted_at IS NULL
 *   - Historical records retained for audit/compliance purposes
 *   - Contact details (email, phone) are stored in the communication table
 */
export const contactPerson = pgTable(
  'contact_person',
  {
    ...baseEntity(), // includes: isActive, deletedAt

    // Polymorphic ownership
    entityFk: bigint('entity_fk', { mode: 'number' })
      .notNull()
      .references(() => entity.id, { onDelete: 'restrict' }),
    recordId: bigint('record_id', { mode: 'number' }).notNull(),

    // Fields
    contactPersonTypeFk: bigint('contact_person_type_fk', { mode: 'number' })
      .notNull()
      .references(() => contactPersonType.id, { onDelete: 'restrict' }),

    // Salutation (MR, MRS, MS, DR, PROF, HON, REV, IMAM, SRI, SHRI, SRIMATI)
    // NORMALIZED: Dedicated table instead of code_value pattern
    salutationFk: bigint('salutation_fk', { mode: 'number' }).references(
      () => salutationType.id,
      { onDelete: 'set null' },
    ),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }),
    // Designation (Manager, Cashier, Accountant, Supervisor, etc.)
    // NORMALIZED: Dedicated table instead of free-text
    designationFk: bigint('designation_fk', { mode: 'number' }).references(
      () => designationType.id,
      { onDelete: 'set null' },
    ),
    // Fallback: free-text designation if no matching lookup entry
    designationFreeText: varchar('designation_free_text', { length: 100 }),

    // email, officeNumber, mobileNumber intentionally absent.
    // Contact details are stored via the communication table using polymorphic ownership
    // (entityFk → 'contact_person', recordId → this row's id). Storing them here
    // would duplicate the communication table's responsibility.

    isPrimary: boolean('is_primary').notNull().default(false),

    ...auditFields(() => users.id),
  },
  (table) => [
    // Composite index: WHERE entity_fk = ? AND record_id = ?
    index('contact_person_entity_record_idx').on(
      table.entityFk,
      table.recordId,
    ),
    // Partial index: same lookup filtered to active rows only
    index('contact_person_entity_record_active_idx')
      .on(table.entityFk, table.recordId)
      .where(sql`is_active = true`),

    // Only one primary contact person per record.
    uniqueIndex('contact_person_one_primary_idx')
      .on(table.entityFk, table.recordId)
      .where(sql`is_primary = true AND deleted_at IS NULL`),
    check(
      'contact_person_designation_required',
      sql`designation_fk IS NOT NULL OR designation_free_text IS NOT NULL`,
    ),
  ],
);

export type ContactPerson = typeof contactPerson.$inferSelect;
export type NewContactPerson = typeof contactPerson.$inferInsert;
export type UpdateContactPerson = Partial<Omit<NewContactPerson, 'id'>>;
export type PublicContactPerson = Omit<
  ContactPerson,
  'isActive' | 'deletedAt' | 'deletedBy' | 'createdBy' | 'modifiedBy'
>;
