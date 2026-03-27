import { relations } from 'drizzle-orm';
import { designation } from './designation.table';
import { storeUserMapping } from '../store-user-mapping';

export const designationRelations = relations(designation, ({ many }) => ({
  storeUsers: many(storeUserMapping),
}));
