import { relations } from 'drizzle-orm';
import { currency } from './currency.table';

// Currency is referenced by plan_price table (when implemented).
// Relations defined in plan_price.relations.ts
export const currencyRelations = relations(currency, () => ({}));
