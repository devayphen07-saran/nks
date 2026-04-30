import { pgTable, varchar, text } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Communication Type Lookup
 * Communication channels (Email, Phone, Mobile, Fax, WhatsApp, Telegram, Website, LinkedIn)
 *
 * ⚠ DO NOT CONSOLIDATE INTO `lookup` TABLE.
 * Reason: `icon` (UI asset reference) and `validation_regex` (per-channel input
 *   validation, e.g. email vs phone format) are business columns that cannot
 *   live in the generic (code, label, description) shape of `lookup`.
 * Registered in `lookup_type` with has_table=true for catalog discoverability.
 * Confirmed against Ayphen reference (2026-04-30): also kept dedicated.
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
