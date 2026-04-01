import { relations } from 'drizzle-orm';
import { taxRateMaster } from './tax-rate-master.table';
import { country } from '../country';
import { store } from '../store';
import { commodityCodes } from '../commodity-codes';
import { transactionTaxLines } from '../transaction-tax-lines';

export const taxRateMasterRelations = relations(
  taxRateMaster,
  ({ one, many }) => ({
    rateCountry: one(country, {
      fields: [taxRateMaster.countryFk],
      references: [country.id],
    }),
    rateStore: one(store, {
      fields: [taxRateMaster.storeFk],
      references: [store.id],
    }),
    commodityCode: one(commodityCodes, {
      fields: [taxRateMaster.commodityCodeFk],
      references: [commodityCodes.id],
    }),
    transactionLines: many(transactionTaxLines),
  }),
);
