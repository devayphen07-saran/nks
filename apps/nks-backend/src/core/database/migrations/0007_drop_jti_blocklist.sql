-- Drops the jti_blocklist table. The backend validates sessions by DB lookup
-- against user_session, so JWT-level revocation never gated any request — see
-- https://… (architecture review). Removing the table eliminates the join in
-- the hot auth context query and one cleanup job. The user_session.jti column
-- is kept as a JWT claim for tracing.
--> statement-breakpoint

DROP INDEX IF EXISTS "jti_blocklist_expires_idx";
--> statement-breakpoint

DROP TABLE IF EXISTS "jti_blocklist";
