import { relations } from 'drizzle-orm';
import { entityType } from './entity-type.table';

export const entityTypeRelations = relations(entityType, ({ one, many }) => ({
  parent: one(entityType, {
    fields: [entityType.parentEntityTypeFk],
    references: [entityType.id],
    relationName: 'entity_type_children',
  }),
  children: many(entityType, {
    relationName: 'entity_type_children',
  }),
}));
