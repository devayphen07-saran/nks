import { relations } from 'drizzle-orm';
import { taxNames } from './tax-names.table';
import { taxAgencies } from '../../tax/tax-agencies';
import { taxLevels } from '../../tax/tax-levels';

export const taxNamesRelations = relations(taxNames, ({ one, many }) => ({
  agency: one(taxAgencies, {
    fields: [taxNames.taxAgencyFk],
    references: [taxAgencies.id],
  }),
  levels: many(taxLevels),
}));
