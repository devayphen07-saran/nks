import { relations } from 'drizzle-orm';
import { addressType } from './address-type.table';
import { address } from '../address';

export const addressTypeRelations = relations(addressType, ({ many }) => ({
  addresses: many(address),
}));
