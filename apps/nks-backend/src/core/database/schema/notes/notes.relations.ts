import { relations } from 'drizzle-orm';
import { notes } from './notes.table';
import { entity } from '../entity';
import { notesType } from '../notes-type';
import { users } from '../users';

export const notesRelations = relations(notes, ({ one }) => ({
  entity: one(entity, {
    fields: [notes.entityFk],
    references: [entity.id],
  }),
  notesType: one(notesType, {
    fields: [notes.notesTypeFk],
    references: [notesType.id],
  }),
  createdByUser: one(users, {
    fields: [notes.createdBy],
    references: [users.id],
    relationName: 'createdByUser',
  }),
  modifiedByUser: one(users, {
    fields: [notes.modifiedBy],
    references: [users.id],
    relationName: 'modifiedByUser',
  }),
  deletedByUser: one(users, {
    fields: [notes.deletedBy],
    references: [users.id],
    relationName: 'deletedByUser',
  }),
}));
