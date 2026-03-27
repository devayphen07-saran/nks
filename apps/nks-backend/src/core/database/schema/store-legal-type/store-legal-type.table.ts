import { pgTable, varchar, text } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../base.entity';
import { users } from '../users';

// Legal entity structure for KYC/registration classification.
// Seeded values: 'Pvt Ltd', 'Sole Proprietor', 'Partnership', 'LLP', 'Public Ltd'
// NOT for POS functional grouping — see store_category for that.
export const storeLegalType = pgTable('store_legal_type', {
  ...baseEntity(),

  legalTypeName: varchar('legal_type_name', { length: 50 }).notNull().unique(), // e.g. 'Pvt Ltd'
  legalTypeCode: varchar('legal_type_code', { length: 30 }).notNull().unique(), // e.g. 'PVT_LTD'
  description: text('description'),

  ...auditFields(() => users.id),
});

export type StoreLegalType = typeof storeLegalType.$inferSelect;
export type NewStoreLegalType = typeof storeLegalType.$inferInsert;
export type UpdateStoreLegalType = Partial<Omit<NewStoreLegalType, 'id'>>;
