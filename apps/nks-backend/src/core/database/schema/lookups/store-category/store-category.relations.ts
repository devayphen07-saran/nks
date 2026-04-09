import { relations } from 'drizzle-orm';
import { storeCategory } from './store-category.table';

export const storeCategoryRelations = relations(storeCategory, () => ({}));
