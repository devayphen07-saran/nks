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
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

import { coreEntity, auditFields } from '../../base.entity';
import { authMethodEnum } from '../../enums';

// Self-referential workaround: blockedBy and auditFields both reference users.id.
// Cast via selfRef() to break the circular type-inference cycle.
const selfRef = (): AnyPgColumn => users.id;

export const users = pgTable(
  'users',
  {
    ...coreEntity(),

    // Cross-service identity anchor for the Ayphen platform.
    //
    // This is the **primary external user identifier** used in REST paths — e.g.
    // `/v1/users/:iamUserId/companies/owner`, `/v1/users/:iamUserId/favorites`,
    // `/v1/companies/:tenantId/users/:iamUserId/deactivate`.
    //
    // Required (NOT NULL) — minted for every user at creation via crypto.randomUUID()
    // never re-used or rotated.
    //
    // Included as a required claim in every RS256 access and offline JWT
    // so external services can correlate NKS users without hitting this DB.
    // Query entry-point: AuthUsersRepository.findByIamUserId().
    iamUserId: varchar('iam_user_id', { length: 64 }).notNull().unique(),

    firstName: varchar('first_name', { length: 255 }).notNull(),
    lastName: varchar('last_name', { length: 255 }).notNull().default(''),
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
    accountLockedUntil: timestamp('account_locked_until', {
      withTimezone: true,
    }),
    blockedBy: bigint('blocked_by', { mode: 'number' }).references(selfRef, {
      onDelete: 'set null',
    }),

    primaryLoginMethod: authMethodEnum('primary_login_method'),

    loginCount: integer('login_count').notNull().default(0),
    // Consecutive failed logins since the last successful one.
    // Reset to 0 on success; used with isBlocked for brute-force lockout.
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),

    // Default store — user's preferred store, auto-populated into session on login.
    // NULL for new users with no store. Set on first store creation.
    // Changed via PUT /stores/default. Only one default at a time.
    // FK (→ store.id ON DELETE SET NULL) is in migration 031 — cannot be declared
    // here due to the users ↔ store circular import. Relation in users.relations.ts.
    defaultStoreFk: bigint('default_store_fk', { mode: 'number' }),

    // Onboarding lifecycle
    profileCompleted: boolean('profile_completed').notNull().default(false),
    profileCompletedAt: timestamp('profile_completed_at', {
      withTimezone: true,
    }),

    // Monotonic counter incremented on any role/permission change.
    // Mobile apps send their last-known version; the server returns only the delta.
    permissionsVersion: integer('permissions_version').notNull().default(1),

    // Security flag: lives here (not user_preferences) so auth reads it without a join.
    twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),

    ...auditFields(selfRef),
  },
  (table) => [
    // Ensure at least one contact method (email OR phone) exists
    check(
      'users_contact_method_chk',
      sql`email IS NOT NULL OR phone_number IS NOT NULL`,
    ),
    index('users_email_idx').on(table.email),
    index('users_phone_number_idx').on(table.phoneNumber),
    uniqueIndex('users_iam_user_id_idx').on(table.iamUserId),
    index('users_default_store_idx').on(table.defaultStoreFk),
    index('users_blocked_by_idx').on(table.blockedBy),
    index('users_profile_completed_idx').on(table.profileCompleted),
    index('users_permissions_version_idx').on(table.permissionsVersion),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UpdateUser = Partial<Omit<NewUser, 'id'>>;
export type PublicUser = Omit<
  User,
  'isActive' | 'deletedAt' | 'deletedBy' | 'createdBy' | 'modifiedBy'
>;
