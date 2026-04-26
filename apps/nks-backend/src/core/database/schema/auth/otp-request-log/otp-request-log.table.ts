import { pgTable, text, timestamp, uniqueIndex, smallint, index } from 'drizzle-orm/pg-core';
import { betterAuthEntity } from '../../base.entity';

// Track OTP requests per identifier to enforce rate limits.
// Prevents DoS attacks by spamming OTP requests (expensive SMS/email sends).
// Hard-deleted after 24 hours via cron or manual cleanup.
//
// PRIVACY: identifier_hash is SHA256(phone/email + serverPepper)
// Never store plaintext phone/email in this table (compliance: GDPR, India DPDP Act).
export const otpRequestLog = pgTable(
  'otp_request_log',
  {
    ...betterAuthEntity(),

    // identifier_hash — SHA256(phone/email + serverPepper)
    // Never store plaintext phone/email (GDPR, DPDP Act compliance)
    // Lookup: hash incoming phone/email, search by hash
    identifierHash: text('identifier_hash').notNull(),

    // requestCount — how many times this identifier requested OTP in the window
    requestCount: smallint('request_count').notNull().default(1),

    // windowExpiresAt — reset window expires at this time (1h from first request)
    // After expiry, requestCount resets to 0
    windowExpiresAt: timestamp('window_expires_at', {
      withTimezone: true,
    }).notNull(),

    // lastAttemptAt — timestamp of most recent OTP request (for exponential backoff)
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),

    // consecutiveFailures — count of failed OTP verifications (for exponential backoff)
    // Resets to 0 on successful verification or window expiry
    consecutiveFailures: smallint('consecutive_failures').notNull().default(0),

    // expiresAt — row-level TTL for hard-delete cleanup (24h from last window reset)
    // Distinct from windowExpiresAt (which tracks the 1h rate-limit window).
    // A cron job deletes rows WHERE expires_at < NOW().
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('otp_request_log_identifier_hash_idx').on(table.identifierHash),
    index('otp_request_log_expires_at_idx').on(table.expiresAt),
  ],
);

export type OtpRequestLog = typeof otpRequestLog.$inferSelect;
export type NewOtpRequestLog = typeof otpRequestLog.$inferInsert;
