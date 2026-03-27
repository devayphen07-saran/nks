import { pgTable, varchar, boolean } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../base.entity';
import { users } from '../users';

export const contactPersonType = pgTable('contact_person_type', {
  ...baseEntity(),

  contactPersonTypeName: varchar('contact_person_type_name', { length: 50 })
    .notNull()
    .unique(), // Owner, Manager, Accountant
  contactPersonTypeCode: varchar('contact_person_type_code', { length: 30 })
    .notNull()
    .unique(), // OWNER, MANAGER, ACCOUNTANT
  description: varchar('description', { length: 200 }),

  // Whether this type can receive alerts / notifications
  canReceiveAlerts: boolean('can_receive_alerts').notNull().default(false),

  ...auditFields(() => users.id),
});

export type ContactPersonType = typeof contactPersonType.$inferSelect;
export type NewContactPersonType = typeof contactPersonType.$inferInsert;
export type UpdateContactPersonType = Partial<Omit<NewContactPersonType, 'id'>>;
