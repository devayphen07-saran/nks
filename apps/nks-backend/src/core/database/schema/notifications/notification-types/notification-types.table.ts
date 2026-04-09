import { pgTable, varchar, text } from 'drizzle-orm/pg-core';
import { baseEntity } from '../../base.entity';
import { notificationChannelEnum } from '../../enums';

/**
 * notification_types — reference table replacing the notificationTypeEnum.
 * Add a new type by inserting a row — no code change or migration needed.
 *
 * isSystem = true  → seeded types (ORDER_UPDATE, INVITE, SYSTEM, PROMO) — cannot be deleted
 * isSystem = false → custom types added by admin
 */
export const notificationTypes = pgTable('notification_types', {
  ...baseEntity(), // id, guuid, isActive, createdAt, updatedAt, deletedAt, sortOrder, isHidden, isSystem

  code: varchar('code', { length: 50 }).notNull().unique(), // 'ORDER_UPDATE' — used in code
  name: varchar('name', { length: 100 }).notNull(), // 'Order Update' — human label
  description: text('description'),

  // Controls which delivery path the notify() service uses for this type.
  //   WEBSOCKET → skip Expo Push entirely (online-only, e.g. live typing indicators)
  //   PUSH      → skip WebSocket emit, always send push (e.g. marketing promos)
  //   BOTH      → fire WebSocket first; also send push regardless of online state (default)
  channelPolicy: notificationChannelEnum('channel_policy')
    .notNull()
    .default('BOTH'),
});

export type NotificationType = typeof notificationTypes.$inferSelect;
export type NewNotificationType = typeof notificationTypes.$inferInsert;
