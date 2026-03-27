import { relations } from 'drizzle-orm';
import { notes } from './notes.table';
import { entity } from '../entity';

export const notesRelations = relations(notes, ({ one }) => ({
  entity: one(entity, {
    fields: [notes.entityFk],
    references: [entity.id],
  }),
}));
