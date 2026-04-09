import { pgTable, varchar, text, boolean, integer } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Notification Status Lookup
 * Notification states (Pending, Sent, Delivered, Failed, Read, Expired, Retry)
 * Replaces hardcoded enum: notificationStatusEnum
 */
export const notificationStatus = pgTable('notification_status', {
  ...baseEntity(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  label: varchar('label', { length: 100 }).notNull(),
  description: text('description'),
  isTerminal: boolean('is_terminal').default(false), // true = no further state changes
  isError: boolean('is_error').default(false),
  retryable: boolean('is_retryable').default(false),
  displayOrder: integer('display_order').default(0),
  ...auditFields(() => users.id),
});

export type NotificationStatus = typeof notificationStatus.$inferSelect;
export type NewNotificationStatus = typeof notificationStatus.$inferInsert;
