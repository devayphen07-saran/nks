import { relations } from 'drizzle-orm';
import { taxFilingFrequency } from './tax-filing-frequency.table';

export const taxFilingFrequencyRelations = relations(taxFilingFrequency, () => ({}));
