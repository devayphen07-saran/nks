import { relations } from 'drizzle-orm';
import { lookupType } from './lookup-type.table';
import { lookup } from '../lookup/lookup.table';

export const lookupTypeRelations = relations(lookupType, ({ many }) => ({
  lookups: many(lookup),
}));
