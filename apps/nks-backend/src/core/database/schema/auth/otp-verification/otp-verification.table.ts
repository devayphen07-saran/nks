import {
  pgTable,
  text,
  timestamp,
  smallint,
  boolean,
  index,
  bigint,
} from 'drizzle-orm/pg-core';
import { betterAuthEntity } from '../../base.entity';
import { otpPurposeEnum } from '../../enums';
import { userAuthProvider } from '../../auth/user-auth-provider';

// BetterAuth-managed table (modelName: 'verification' → 'otp_verification').
// Uses betterAuthEntity — no soft-delete, no audit fields, hard-deleted on expiry or cascade.
export const otpVerification = pgTable(
  'otp_verification',
  {
    ...betterAuthEntity(),

    // identifier — the delivery target (email address or E.164 phone number)
    identifier: text('identifier').notNull(),

    // value — the OTP code (stored hashed in production)
    value: text('value').notNull(),

    // purpose — why this OTP was issued.
    // Prevents a RESET_PASSWORD token from being accepted at the LOGIN endpoint.
    purpose: otpPurposeEnum('purpose').notNull(),

    // attempts — how many times the user has submitted an incorrect code.
    // Brute-force protection: reject after N failed attempts.
    attempts: smallint('attempts').notNull().default(0),

    // isUsed — consumed flag set to true immediately on first successful verification.
    // Prevents OTP replay: once accepted, the same code is rejected on any subsequent attempt.
    isUsed: boolean('is_used').notNull().default(false),

    // expiresAt — hard expiry after which the OTP is invalid regardless of isUsed.
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

    // authProviderId — optional FK to user_auth_provider
    // For EMAIL_VERIFY and PHONE_VERIFY: links OTP to the auth provider being verified
    // For LOGIN and RESET_PASSWORD: NULL (user not yet authenticated)
    authProviderId: bigint('auth_provider_fk', { mode: 'number' }).references(
      () => userAuthProvider.id,
      { onDelete: 'restrict' }, // ← FIXED: prevent auth provider deletion if OTP exists (preserve audit trail)
    ),

    // reqId — MSG91 request ID, prevents OTP replay attacks
    // Issued by MSG91 when OTP is sent, must match on verification
    // NULL for email OTPs (only MSG91 phone OTPs have reqId)
    reqId: text('req_id'),
  },
  (table) => [
    // Fast lookup: find active OTP by identifier + purpose (used at every verify attempt)
    index('otp_verification_identifier_purpose_idx').on(
      table.identifier,
      table.purpose,
    ),
    // Fast lookup by auth provider when verifying email/phone
    index('otp_verification_auth_provider_idx').on(table.authProviderId),
  ],
);

export type OtpVerification = typeof otpVerification.$inferSelect;
export type NewOtpVerification = typeof otpVerification.$inferInsert;
