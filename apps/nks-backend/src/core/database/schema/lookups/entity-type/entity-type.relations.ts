import { relations } from 'drizzle-orm';
import { entityType } from './entity-type.table';

export const entityTypeRelations = relations(entityType, () => ({}));
