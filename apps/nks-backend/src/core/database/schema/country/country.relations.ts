import { relations } from 'drizzle-orm';
import { country } from './country.table';
import { stateRegionProvince } from '../state-region-province/state-region-province.table';

export const countryRelations = relations(country, ({ many }) => ({
  states: many(stateRegionProvince),
}));
