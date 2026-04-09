import { relations } from 'drizzle-orm';
import { taxLineStatus } from './tax-line-status.table';

export const taxLineStatusRelations = relations(taxLineStatus, () => ({}));
