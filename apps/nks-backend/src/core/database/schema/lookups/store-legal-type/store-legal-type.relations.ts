import { relations } from 'drizzle-orm';
import { storeLegalType } from './store-legal-type.table';

export const storeLegalTypeRelations = relations(storeLegalType, () => ({}));
