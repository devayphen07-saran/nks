import { relations } from 'drizzle-orm';
import { taxRegistrationType } from './tax-registration-type.table';

export const taxRegistrationTypeRelations = relations(taxRegistrationType, () => ({}));
