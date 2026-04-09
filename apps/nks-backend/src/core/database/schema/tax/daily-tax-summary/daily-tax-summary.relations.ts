import { relations } from 'drizzle-orm';
import { dailyTaxSummary } from './daily-tax-summary.table';
import { country } from '../../location/country';
import { store } from '../../store/store';

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
