import { pgTable, bigint, text, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { entity } from '../entity';
import { users } from '../users';
import { notesType } from '../notes-type';
import { baseEntity, auditFields } from '../base.entity';

/**
 * NOTES
 *
 * Polymorphic note storage for any entity (internal remarks, customer notes, etc.)
 * Uses soft-delete pattern: isActive (legacy) and deletedAt (preferred).
 *
 * Soft-delete strategy:
 *   - Active notes: isActive=true AND deletedAt IS NULL
 *   - Deleted notes: isActive=false OR deletedAt IS NOT NULL
 *   - Queries should filter: WHERE is_active = true AND deleted_at IS NULL
 *   - Historical records retained for audit/compliance purposes
 *   - Once a note is soft-deleted, it cannot be recovered
 */
export const notes = pgTable(
  'notes',
  {
    ...baseEntity(), // includes: isActive, deletedAt

    // Polymorphic ownership
    entityFk: bigint('entity_fk', { mode: 'number' })
      .notNull()
      .references(() => entity.id, { onDelete: 'restrict' }),
    recordId: bigint('record_id', { mode: 'number' }).notNull(),

    // Fields
    notesTypeFk: bigint('notes_type_fk', { mode: 'number' })
      .notNull()
      .references(() => notesType.id, { onDelete: 'restrict' }),
    content: text('content').notNull(),

    ...auditFields(() => users.id),
  },
  (table) => [
    index('notes_entity_record_idx').on(table.entityFk, table.recordId),
    // Partial index: same lookup filtered to active rows only — avoids scanning soft-deleted notes.
    index('notes_entity_record_active_idx')
      .on(table.entityFk, table.recordId)
      .where(sql`is_active = true`),

    // Single-column indexes for FK-only queries
    index('notes_entity_idx').on(table.entityFk),
    index('notes_record_idx').on(table.recordId),
    index('notes_type_idx').on(table.notesTypeFk),
  ],
);

export type Notes = typeof notes.$inferSelect;
export type NewNotes = typeof notes.$inferInsert;
export type UpdateNotes = Partial<Omit<NewNotes, 'id'>>;
export type PublicNotes = Omit<
  Notes,
  'isActive' | 'deletedAt' | 'deletedBy' | 'createdBy' | 'modifiedBy'
>;
