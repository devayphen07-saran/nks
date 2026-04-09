import { relations } from 'drizzle-orm';
import { lookup } from './lookup.table';
import { lookupType } from '../lookup-type/lookup-type.table';

export const lookupRelations = relations(lookup, ({ one }) => ({
  type: one(lookupType, {
    fields: [lookup.lookupTypeFk],
    references: [lookupType.id],
  }),
}));
