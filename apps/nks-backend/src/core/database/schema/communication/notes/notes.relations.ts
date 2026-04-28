import { relations } from 'drizzle-orm';
import { notes } from './notes.table';
import { entity } from '../../entity-system/entity';
import { lookup } from '../../lookups/lookup/lookup.table';
import { users } from '../../auth/users';

export const notesRelations = relations(notes, ({ one }) => ({
  entity: one(entity, {
    fields: [notes.entityFk],
    references: [entity.id],
  }),
  notesType: one(lookup, {
    fields: [notes.notesTypeFk],
    references: [lookup.id],
    relationName: 'notesType',
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
