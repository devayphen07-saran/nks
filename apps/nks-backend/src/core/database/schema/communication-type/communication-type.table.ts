import { pgTable, varchar, text } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../base.entity';
import { users } from '../users';

export const communicationType = pgTable('communication_type', {
  ...baseEntity(),

  communicationTypeName: varchar('communication_type_name', { length: 50 })
    .notNull()
    .unique(), // e.g. 'Mobile', 'Email', 'Fax', 'WhatsApp'
  communicationTypeCode: varchar('communication_type_code', { length: 30 })
    .notNull()
    .unique(), // e.g. 'MOBILE', 'EMAIL', 'FAX', 'WHATSAPP'
  description: text('description'),

  ...auditFields(() => users.id),
});

export type CommunicationType = typeof communicationType.$inferSelect;
export type NewCommunicationType = typeof communicationType.$inferInsert;
export type UpdateCommunicationType = Partial<Omit<NewCommunicationType, 'id'>>;
