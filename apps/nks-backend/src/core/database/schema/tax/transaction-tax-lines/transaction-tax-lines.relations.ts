import { relations } from 'drizzle-orm';
import { transactionTaxLines } from './transaction-tax-lines.table';
import { country } from '../../location/country';
import { store } from '../../store/store';
import { taxRegistrations } from '../../tax/tax-registrations';
import { commodityCodes } from '../../tax/commodity-codes';
import { taxRateMaster } from '../../tax/tax-rate-master';
import { users } from '../../auth/users';

export const transactionTaxLinesRelations = relations(
  transactionTaxLines,
  ({ one }) => ({
    transactionCountry: one(country, {
      fields: [transactionTaxLines.countryFk],
      references: [country.id],
    }),
    transactionStore: one(store, {
      fields: [transactionTaxLines.storeFk],
      references: [store.id],
    }),
    registration: one(taxRegistrations, {
      fields: [transactionTaxLines.taxRegistrationFk],
      references: [taxRegistrations.id],
    }),
    commodityCode: one(commodityCodes, {
      fields: [transactionTaxLines.commodityCodeFk],
      references: [commodityCodes.id],
    }),
    appliedRate: one(taxRateMaster, {
      fields: [transactionTaxLines.taxRateMasterFk],
      references: [taxRateMaster.id],
    }),
    recordedByUser: one(users, {
      fields: [transactionTaxLines.createdBy],
      references: [users.id],
      relationName: 'transactionTaxLinesCreatedBy',
    }),
  }),
);
