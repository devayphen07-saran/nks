import { pgTable, varchar, text } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../base.entity';
import { users } from '../users';

export const salutation = pgTable('salutation', {
  ...baseEntity(),

  salutationText: varchar('salutation_text', { length: 20 }).notNull().unique(), // e.g. 'Mr.', 'Mrs.', 'Dr.', 'Shri'
  description: text('description'),

  ...auditFields(() => users.id),
});

export type Salutation = typeof salutation.$inferSelect;
export type NewSalutation = typeof salutation.$inferInsert;
export type UpdateSalutation = Partial<Omit<NewSalutation, 'id'>>;
