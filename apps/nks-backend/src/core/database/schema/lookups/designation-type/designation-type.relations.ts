import { relations } from 'drizzle-orm';
import { designationType } from './designation-type.table';

export const designationTypeRelations = relations(designationType, () => ({}));
