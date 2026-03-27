import {
  pgTable,
  text,
  timestamp,
  index,
  smallint,
} from 'drizzle-orm/pg-core';
import { betterAuthEntity } from '../base.entity';

// Track OTP requests per identifier to enforce rate limits.
// Prevents DoS attacks by spamming OTP requests (expensive SMS/email sends).
// Hard-deleted after 24 hours via cron or manual cleanup.
export const otpRequestLog = pgTable(
  'otp_request_log',
  {
    ...betterAuthEntity(),

    // identifier — phone number or email (from OTP send request)
    identifier: text('identifier').notNull(),

    // requestCount — how many times this identifier requested OTP in the window
    requestCount: smallint('request_count').notNull().default(1),

    // windowExpiresAt — reset window expires at this time (24h from first request)
    // After expiry, requestCount resets to 0
    windowExpiresAt: timestamp('window_expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    // Fast lookup: find rate limit record by identifier
    // Used at every OTP send request to check if limit exceeded
    index('otp_request_log_identifier_idx').on(table.identifier),
  ],
);

export type OtpRequestLog = typeof otpRequestLog.$inferSelect;
export type NewOtpRequestLog = typeof otpRequestLog.$inferInsert;
