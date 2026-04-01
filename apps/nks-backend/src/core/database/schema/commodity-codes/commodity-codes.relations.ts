import { relations } from 'drizzle-orm';
import { commodityCodes } from './commodity-codes.table';
import { country } from '../country';
import { taxRateMaster } from '../tax-rate-master';
import { transactionTaxLines } from '../transaction-tax-lines';

export const commodityCodesRelations = relations(
  commodityCodes,
  ({ one, many }) => ({
    commodityCountry: one(country, {
      fields: [commodityCodes.countryFk],
      references: [country.id],
    }),
    taxRates: many(taxRateMaster),
    transactionTaxLines: many(transactionTaxLines),
  }),
);
