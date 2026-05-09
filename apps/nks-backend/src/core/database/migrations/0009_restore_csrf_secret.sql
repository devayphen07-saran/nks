-- Restores user_session.csrf_secret. Pure double-submit (header == cookie) was
-- vulnerable to subdomain cookie tossing — an attacker controlling a sibling
-- subdomain could set the csrf_token cookie and pass validation. Binding the
-- secret to a server-controlled column blocks that attack at zero cost since
-- the auth context query already SELECTs the session row.
--> statement-breakpoint

ALTER TABLE "user_session" ADD COLUMN IF NOT EXISTS "csrf_secret" varchar(64) NOT NULL DEFAULT '';
