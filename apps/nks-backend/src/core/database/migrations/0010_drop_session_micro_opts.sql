-- Drops three security micro-optimisations that added cognitive load without
-- meaningful security gain:
--
--   user_session.role_hash             — duplicated by users.permissions_version
--   user_session.ip_hash               — only fed log-only detectIpChange (never blocked)
--   otp_request_log.consecutive_failures — exponential backoff on top of an
--                                         already-secure 5/hour rate limit
--
-- See architecture review for the full rationale.
--> statement-breakpoint

ALTER TABLE "user_session" DROP COLUMN IF EXISTS "role_hash";
--> statement-breakpoint

ALTER TABLE "user_session" DROP COLUMN IF EXISTS "ip_hash";
--> statement-breakpoint

ALTER TABLE "otp_request_log" DROP COLUMN IF EXISTS "consecutive_failures";
