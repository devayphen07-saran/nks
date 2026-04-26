import {
  pgTable,
  bigint,
  varchar,
  text,
  jsonb,
  timestamp,
  smallint,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { coreEntity } from '../../base.entity';
import { users } from '../../auth/users';
import { store } from '../../store/store';
import { notificationTypes } from '../../notifications/notification-types';
import { notificationTemplates } from '../../notifications/notification-templates';
import { notificationStatus } from '../../lookups/notification-status/notification-status.table';

export const notifications = pgTable(
  'notifications',
  {
    ...coreEntity(), // id, guuid, isActive, createdAt, updatedAt, deletedAt

    // ── Recipient ────────────────────────────────────────────────────────────
    userFk: bigint('user_fk', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // storeFk — which store this notification originated from.
    // NULL for user-level notifications (account alerts, promos).
    // Required for multi-store users to filter their notification inbox by store.
    storeFk: bigint('store_fk', { mode: 'number' }).references(() => store.id, {
      onDelete: 'set null',
    }),

    // ── Type + Template ──────────────────────────────────────────────────────
    // typeFk resolves to a row in notification_types (ORDER_UPDATE, INVITE, etc.)
    // templateFk records which template was rendered — nullable (system / ad-hoc notifications skip templates)
    typeFk: bigint('type_fk', { mode: 'number' })
      .notNull()
      .references(() => notificationTypes.id, { onDelete: 'restrict' }),

    templateFk: bigint('template_fk', { mode: 'number' }).references(
      () => notificationTemplates.id,
      { onDelete: 'set null' },
    ),

    // ── Rendered content (snapshot at send time) ─────────────────────────────
    // Stored here so the notification history is accurate even if the template changes later
    title: varchar('title', { length: 255 }).notNull(),
    body: text('body').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>(), // Deep-link payload { screen, id, … }

    // ── Delivery ─────────────────────────────────────────────────────────────
    // channel column removed — use expoPushTicketId as the indicator:
    //   IS NOT NULL → push was attempted via Expo
    //   IS NULL     → websocket only (user was online when notification fired)
    // NORMALIZED: Status is now an FK to notification_status lookup table (was enum)
    statusFk: bigint('status_fk', { mode: 'number' })
      .notNull()
      .references(() => notificationStatus.id, { onDelete: 'restrict' }),
    failureReason: text('failure_reason'), // Expo error message when status = FAILED

    // ── Retry tracking ───────────────────────────────────────────────────────
    // retryCount: how many times the cron has already retried this notification.
    // maxRetries: ceiling — cron stops after this many attempts (default 3).
    // expiresAt:  hard cutoff — cron skips retrying after this time regardless of retryCount.
    //             Prevents retrying a 3-day-old promo that is no longer relevant.
    retryCount: smallint('retry_count').notNull().default(0),
    maxRetries: smallint('max_retries').notNull().default(3),
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    // ── Expo Push tracking ───────────────────────────────────────────────────
    // ticket.id returned immediately by sendPushNotificationsAsync()
    // Used 30 min later in the receipt cron to confirm actual delivery
    // NULL means no push was dispatched (user was connected via WebSocket)
    expoPushTicketId: varchar('expo_push_ticket_id', { length: 255 }),

    // ── Timestamps ───────────────────────────────────────────────────────────
    // sentAt:      null until push is actually dispatched (NOT auto-set on insert)
    // deliveredAt: set only for PUSH/BOTH channels when Expo receipt returns ok
    //              Cron must check: only advance SENT → DELIVERED, never touch READ
    // readAt:      set when user opens/reads the notification
    sentAt: timestamp('sent_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (table) => [
    // Time-range queries (e.g., notifications since last sync)
    index('notifications_created_at_idx').on(table.createdAt),

    // Fast lookup: all notifications for a user (ordered by createdAt desc)
    index('notifications_user_fk_idx').on(table.userFk),

    // Composite for "show all PENDING/READ/FAILED notifications for user X"
    index('notifications_user_status_idx').on(table.userFk, table.statusFk),

    // Store-scoped lookup: filter notification inbox by store
    index('notifications_user_store_idx').on(table.userFk, table.storeFk),

    // Partial index — only indexes unread rows; used for badge count on every render
    index('notifications_user_unread_idx')
      .on(table.userFk)
      .where(sql`read_at IS NULL`),

    // Cron index — find rows eligible for retry, filtered by (statusFk, retryCount).
    // Non-partial: the cron query supplies the status code list at runtime via a
    // subquery or IN clause, so no ID is hardcoded here.
    index('notifications_retry_idx').on(table.statusFk, table.retryCount),

    // Unique — one ticket per notification; used for O(1) receipt lookup.
    // PostgreSQL UNIQUE allows multiple NULL values — this is intentional:
    //   NULL     = WebSocket-only delivery, no push was fired
    //   NOT NULL = push was attempted; value is the Expo ticket ID (enforced unique)
    uniqueIndex('notifications_ticket_idx').on(table.expoPushTicketId),
  ],
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
