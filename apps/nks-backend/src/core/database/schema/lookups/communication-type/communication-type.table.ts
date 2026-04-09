import { pgTable, varchar, text } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Communication Type Lookup
 * Communication channels (Email, Phone, Mobile, Fax, WhatsApp, Telegram, Website, LinkedIn)
 */
export const communicationType = pgTable('communication_type', {
  ...baseEntity(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  label: varchar('label', { length: 100 }).notNull(),
  description: text('description'),
  icon: varchar('icon', { length: 100 }), // for UI
  validationRegex: varchar('validation_regex', { length: 255 }), // for validation
  ...auditFields(() => users.id),
});

export type CommunicationType = typeof communicationType.$inferSelect;
export type NewCommunicationType = typeof communicationType.$inferInsert;
