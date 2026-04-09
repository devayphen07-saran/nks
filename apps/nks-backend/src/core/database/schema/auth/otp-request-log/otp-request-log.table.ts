import { pgTable, text, timestamp, index, smallint } from 'drizzle-orm/pg-core';
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

    // windowExpiresAt — reset window expires at this time (24h from first request)
    // After expiry, requestCount resets to 0
    windowExpiresAt: timestamp('window_expires_at', {
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    // Fast lookup: find rate limit record by identifier hash
    // Used at every OTP send request to check if limit exceeded
    index('otp_request_log_identifier_hash_idx').on(table.identifierHash),
  ],
);

export type OtpRequestLog = typeof otpRequestLog.$inferSelect;
export type NewOtpRequestLog = typeof otpRequestLog.$inferInsert;
