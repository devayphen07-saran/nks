import { relations } from 'drizzle-orm';
import { salutationType } from './salutation-type.table';

export const salutationTypeRelations = relations(salutationType, () => ({}));
