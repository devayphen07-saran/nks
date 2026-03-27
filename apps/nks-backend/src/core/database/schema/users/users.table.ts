import {
  pgTable,
  varchar,
  boolean,
  smallint,
  text,
  integer,
  timestamp,
  bigint,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

import { coreEntity, auditFields } from '../base.entity';
import { authMethodEnum } from '../enums';

// Self-referential workaround: blockedBy and auditFields both reference users.id.
// Cast via selfRef() to break the circular type-inference cycle.
const selfRef = (): AnyPgColumn => users.id;

export const users = pgTable(
  'users',
  {
    ...coreEntity(),

    // BetterAuth opaque user ID — used to cross-reference auth records without
    // exposing our internal bigint PK to the auth layer.
    iamUserId: varchar('iam_user_id', { length: 64 }).unique(),

    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),

    // BetterAuth phoneNumber plugin
    phoneNumber: varchar('phone_number', { length: 20 }).unique(),
    phoneNumberVerified: boolean('phone_number_verified')
      .notNull()
      .default(false),

    // Profile
    kycLevel: smallint('kyc_level').notNull().default(0),
    languagePreference: varchar('language_preference', { length: 5 })
      .notNull()
      .default('en'),
    // Push tokens moved to push_tokens table (per-device, supports multiple devices)
    whatsappOptedIn: boolean('whatsapp_opted_in').notNull().default(true),

    // Block lifecycle
    isBlocked: boolean('is_blocked').notNull().default(false),
    blockedReason: text('blocked_reason'),
    blockedAt: timestamp('blocked_at', { withTimezone: true }),
    accountLockedUntil: timestamp('account_locked_until', { withTimezone: true }),
    blockedBy: bigint('blocked_by', { mode: 'number' }).references(selfRef, {
      onDelete: 'set null',
    }),

    primaryLoginMethod: authMethodEnum('primary_login_method'),
    loginCount: integer('login_count').notNull().default(0),
    // Consecutive failed logins since the last successful one.
    // Reset to 0 on success; used with isBlocked for brute-force lockout.
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    // Denormalized for fast "last seen" queries without joining user_session.
    // Updated on every successful login / token refresh.
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),

    // Onboarding lifecycle
    profileCompleted: boolean('profile_completed').notNull().default(false),
    profileCompletedAt: timestamp('profile_completed_at', { withTimezone: true }),

    ...auditFields(selfRef),
  },
  (table) => [
    index('users_email_idx').on(table.email),
    index('users_phone_number_idx').on(table.phoneNumber),
    uniqueIndex('users_iam_user_id_idx').on(table.iamUserId),
    index('users_blocked_by_idx').on(table.blockedBy),
    index('users_profile_completed_idx').on(table.profileCompleted),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UpdateUser = Partial<Omit<NewUser, 'id'>>;
export type PublicUser = Omit<
  User,
  'isActive' | 'deletedAt' | 'deletedBy' | 'createdBy' | 'modifiedBy'
>;
