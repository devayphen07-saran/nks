import { relations } from 'drizzle-orm';
import { taxRegistrations } from './tax-registrations.table';
import { store } from '../../store/store';
import { country } from '../../location/country';
import { taxAgencies } from '../../tax/tax-agencies';
import { taxNames } from '../../tax/tax-names';

export const taxRegistrationsRelations = relations(
  taxRegistrations,
  ({ one }) => ({
    store: one(store, {
      fields: [taxRegistrations.storeFk],
      references: [store.id],
    }),
    registrationCountry: one(country, {
      fields: [taxRegistrations.countryFk],
      references: [country.id],
    }),
    taxAgency: one(taxAgencies, {
      fields: [taxRegistrations.taxAgencyFk],
      references: [taxAgencies.id],
    }),
    taxName: one(taxNames, {
      fields: [taxRegistrations.taxNameFk],
      references: [taxNames.id],
    }),
  }),
);
