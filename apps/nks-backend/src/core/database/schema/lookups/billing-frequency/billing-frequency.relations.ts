import { relations } from 'drizzle-orm';
import { billingFrequency } from './billing-frequency.table';

export const billingFrequencyRelations = relations(billingFrequency, () => ({}));
