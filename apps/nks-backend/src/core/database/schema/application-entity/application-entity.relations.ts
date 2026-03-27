import { relations } from 'drizzle-orm';
import { applicationEntity } from './application-entity.table';

export const applicationEntityRelations = relations(
  applicationEntity,
  ({ one, many }) => ({
    // Self-reference: parent entity
    parentEntity: one(applicationEntity, {
      fields: [applicationEntity.parentEntityFk],
      references: [applicationEntity.id],
      relationName: 'parent',
    }),

    // Child entities
    childEntities: many(applicationEntity, {
      relationName: 'parent',
    }),
  }),
);
