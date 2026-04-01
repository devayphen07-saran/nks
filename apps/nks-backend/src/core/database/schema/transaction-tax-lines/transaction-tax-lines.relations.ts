import { relations } from 'drizzle-orm';
import { transactionTaxLines } from './transaction-tax-lines.table';
import { country } from '../country';
import { store } from '../store';
import { taxRegistrations } from '../tax-registrations';
import { commodityCodes } from '../commodity-codes';
import { taxRateMaster } from '../tax-rate-master';
import { users } from '../users';

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
