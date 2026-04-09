import { relations } from 'drizzle-orm';
import { entityStatusMapping } from './entity-status-mapping.table';
import { status } from '../../entity-system/status';

export const entityStatusMappingRelations = relations(entityStatusMapping, ({ one }) => ({
  status: one(status, {
    fields: [entityStatusMapping.statusFk],
    references: [status.id],
  }),
}));
