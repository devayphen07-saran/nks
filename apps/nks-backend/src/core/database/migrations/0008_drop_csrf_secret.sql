-- Removes user_session.csrf_secret. CSRF moved to pure double-submit cookie:
-- the request header is compared against the csrf_token cookie value, not a
-- DB-stored secret. Eliminates per-session rotation logic + the column.
--> statement-breakpoint

ALTER TABLE "user_session" DROP COLUMN IF EXISTS "csrf_secret";
