import { relations } from 'drizzle-orm';
import { country } from './country.table';

// Single-country system: relations to deprecated multi-country tables removed
export const countryRelations = relations(country, ({ many }) => ({}));
