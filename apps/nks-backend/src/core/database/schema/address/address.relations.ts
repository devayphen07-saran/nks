import { relations } from 'drizzle-orm';
import { address } from './address.table';
import { entity } from '../entity';

export const addressRelations = relations(address, ({ one }) => ({
  entity: one(entity, {
    fields: [address.entityFk],
    references: [entity.id],
  }),
}));
