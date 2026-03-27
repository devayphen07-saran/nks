import { pgTable, bigint, text, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { entity } from '../entity';
import { users } from '../users';
import { notesType } from '../notes-type';
import { baseEntity, auditFields } from '../base.entity';

export const notes = pgTable(
  'notes',
  {
    ...baseEntity(),

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
  ],
);

export type Notes = typeof notes.$inferSelect;
export type NewNotes = typeof notes.$inferInsert;
export type UpdateNotes = Partial<Omit<NewNotes, 'id'>>;
export type PublicNotes = Omit<
  Notes,
  'isActive' | 'deletedAt' | 'deletedBy' | 'createdBy' | 'modifiedBy'
>;
