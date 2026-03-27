import {
  pgTable,
  bigint,
  text,
  varchar,
  timestamp,
  index,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { coreEntity } from '../base.entity';
import { users } from '../users';
import { deviceTypeEnum } from '../enums';

/**
 * push_tokens — per-user, per-device Expo push token storage.
 *
 * Replaces the single `push_token` column on the users table.
 * A user can have multiple active tokens (phone + tablet, or after reinstall).
 *
 * Token lifecycle:
 *   - INSERT / UPSERT on app launch when token is new or rotated
 *   - isActive = false when Expo receipt returns DeviceNotRegistered error
 *   - Hard-deleted when user deletes their account (CASCADE)
 *
 * WEB is excluded — web users do not register Expo push tokens.
 * The register endpoint must reject requests where deviceType is not IOS or ANDROID.
 */
export const pushTokens = pgTable(
  'push_tokens',
  {
    ...coreEntity(), // id, guuid, isActive, createdAt, updatedAt, deletedAt

    userFk: bigint('user_fk', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // ExponentPushToken[xxxxxx] — the Expo push token string
    token: text('token').notNull(),

    // From BetterAuth session fields (deviceId, deviceName, deviceType)
    deviceId: varchar('device_id', { length: 255 }),
    deviceName: varchar('device_name', { length: 255 }),
    deviceType: deviceTypeEnum('device_type'), // IOS | ANDROID only — WEB rejected at endpoint

    // Updated each time this token is used to send a push
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (table) => [
    // One token per user per device — upsert on (userFk, deviceId)
    unique('push_tokens_user_device_idx').on(table.userFk, table.deviceId),

    // Fast lookup: all active tokens for a user before sending push
    index('push_tokens_user_fk_idx').on(table.userFk),

    // Unique token string — Expo tokens are globally unique
    uniqueIndex('push_tokens_token_idx').on(table.token),
  ],
);

export type PushToken = typeof pushTokens.$inferSelect;
export type NewPushToken = typeof pushTokens.$inferInsert;
