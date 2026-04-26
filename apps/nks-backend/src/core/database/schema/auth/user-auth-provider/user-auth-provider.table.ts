import {
  pgTable,
  text,
  timestamp,
  index,
  bigint,
  boolean,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { betterAuthEntity } from '../../base.entity';
import { users } from '../../auth/users';

// BetterAuth manages this table (modelName: 'account' → 'user_auth_provider').
// betterAuthEntity() — no soft-delete, no audit fields. BetterAuth never sets
// createdBy/modifiedBy/deletedBy, so auditFields() is intentionally absent.
export const userAuthProvider = pgTable(
  'user_auth_provider',
  {
    ...betterAuthEntity(),

    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userFk: bigint('user_fk', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
    }),
    scope: text('scope'),
    password: text('password'),

    // Verification status per auth method
    // A user can have email unverified but phone verified (and vice versa)
    isVerified: boolean('is_verified').notNull().default(false),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
  },
  (table) => [
    index('user_auth_provider_user_idx').on(table.userFk),
    uniqueIndex('user_auth_provider_user_provider_unique').on(
      table.userFk,
      table.providerId,
    ),
  ],
);

export type UserAuthProvider = typeof userAuthProvider.$inferSelect;
export type NewUserAuthProvider = typeof userAuthProvider.$inferInsert;
export type UpdateUserAuthProvider = Partial<Omit<NewUserAuthProvider, 'id'>>;
export type PublicUserAuthProvider = Omit<
  UserAuthProvider,
  'accessToken' | 'refreshToken' | 'idToken' | 'password'
>;
