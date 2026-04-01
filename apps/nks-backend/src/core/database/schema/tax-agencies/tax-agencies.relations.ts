import { relations } from 'drizzle-orm';
import { taxAgencies } from './tax-agencies.table';
import { country } from '../country';
import { taxNames } from '../tax-names';

export const taxAgenciesRelations = relations(taxAgencies, ({ one, many }) => ({
  country: one(country, {
    fields: [taxAgencies.countryFk],
    references: [country.id],
  }),
  taxNames: many(taxNames),
}));
