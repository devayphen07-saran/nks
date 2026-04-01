import { relations } from 'drizzle-orm';
import { dailyTaxSummary } from './daily-tax-summary.table';
import { country } from '../country';
import { store } from '../store';

export const dailyTaxSummaryRelations = relations(
  dailyTaxSummary,
  ({ one }) => ({
    summaryCountry: one(country, {
      fields: [dailyTaxSummary.countryFk],
      references: [country.id],
    }),
    summaryStore: one(store, {
      fields: [dailyTaxSummary.storeFk],
      references: [store.id],
    }),
  }),
);
