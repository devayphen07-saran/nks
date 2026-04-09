import { relations } from 'drizzle-orm';
import { addressType } from './address-type.table';

export const addressTypeRelations = relations(addressType, () => ({}));
