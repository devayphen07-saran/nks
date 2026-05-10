import {
  pgTable,
  bigint,
  text,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { betterAuthEntity } from '../base.entity';
import { users } from '../auth/users';
import { store } from '../store/store';

/**
 * deviceRegistration — links a stable mobile device UUID to a (user, store)
 * pair.
 *
 * Created as a side-effect of login when the request carries an X-Device-Id
 * header. The DeviceAuthGuard reads this table to gate every /sync/* request:
 * a device that isn't registered to the authenticated user's active store
 * cannot push or pull.
 *
 * deviceId is generated on the device at first launch (Keychain on iOS,
 * Keystore on Android) and persists across reinstalls. lastSeenAt is bumped
 * fire-and-forget on every authenticated sync request.
 *
 * Cascading deletes: if a user or store is hard-deleted, their registrations
 * are removed. Sync access for that device is revoked automatically.
 */
export const deviceRegistration = pgTable(
  'device_registration',
  {
    ...betterAuthEntity(),

    deviceId: text('device_id').notNull(),
    userId: bigint('user_fk', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    storeId: bigint('store_fk', { mode: 'number' })
      .notNull()
      .references(() => store.id, { onDelete: 'restrict' }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('device_registration_device_user_store_uq').on(
      table.deviceId,
      table.userId,
      table.storeId,
    ),
    index('device_registration_user_idx').on(table.userId),
  ],
);

export type DeviceRegistration = typeof deviceRegistration.$inferSelect;
export type NewDeviceRegistration = typeof deviceRegistration.$inferInsert;
