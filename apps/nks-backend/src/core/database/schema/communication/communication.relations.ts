import { relations } from 'drizzle-orm';
import { communication } from './communication.table';
import { entity } from '../entity';

export const communicationRelations = relations(communication, ({ one }) => ({
  entity: one(entity, {
    fields: [communication.entityFk],
    references: [entity.id],
  }),
}));
