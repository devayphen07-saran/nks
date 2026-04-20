CREATE TABLE "idempotency_log" (
	"key" text PRIMARY KEY NOT NULL,
	"request_hash" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"expires_at" timestamp with time zone DEFAULT NOW() + INTERVAL '7 days' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_entries" (
	"key" text PRIMARY KEY NOT NULL,
	"hits" integer DEFAULT 1 NOT NULL,
	"window_start" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jti_blocklist" (
	"jti" uuid PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions_changelog" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "permissions_changelog_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_fk" bigint NOT NULL,
	"version_number" integer NOT NULL,
	"entity_code" varchar(100) NOT NULL,
	"operation" varchar(10) NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revoked_devices" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "revoked_devices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_fk" bigint NOT NULL,
	"device_id" varchar(255) NOT NULL,
	"revoked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_by" bigint
);
--> statement-breakpoint
ALTER TABLE "store_user_mapping" DROP CONSTRAINT "store_user_mapping_designation_fk_code_value_id_fk";
--> statement-breakpoint
DROP INDEX "role_entity_permission_role_entity_idx";--> statement-breakpoint
DROP INDEX "notifications_retry_idx";--> statement-breakpoint
DROP INDEX "staff_invite_pending_unique_idx";--> statement-breakpoint
ALTER TABLE "lookup_type" ALTER COLUMN "id" SET DATA TYPE bigserial;--> statement-breakpoint
ALTER TABLE "user_session" ADD COLUMN "jti" uuid;--> statement-breakpoint
ALTER TABLE "otp_verification" ADD COLUMN "req_id" text;--> statement-breakpoint
ALTER TABLE "otp_request_log" ADD COLUMN "last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "otp_request_log" ADD COLUMN "consecutive_failures" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_role_mapping" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "permissions_changelog" ADD CONSTRAINT "permissions_changelog_user_fk_users_id_fk" FOREIGN KEY ("user_fk") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revoked_devices" ADD CONSTRAINT "revoked_devices_user_fk_users_id_fk" FOREIGN KEY ("user_fk") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revoked_devices" ADD CONSTRAINT "revoked_devices_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idempotency_log_processed_idx" ON "idempotency_log" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "idempotency_log_expires_idx" ON "idempotency_log" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "jti_blocklist_expires_idx" ON "jti_blocklist" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "permissions_changelog_user_version_idx" ON "permissions_changelog" USING btree ("user_fk","version_number");--> statement-breakpoint
CREATE INDEX "revoked_devices_user_device_idx" ON "revoked_devices" USING btree ("user_fk","device_id");--> statement-breakpoint
CREATE INDEX "revoked_devices_revoked_at_idx" ON "revoked_devices" USING btree ("revoked_at");--> statement-breakpoint
ALTER TABLE "store_user_mapping" ADD CONSTRAINT "store_user_mapping_designation_fk_designation_type_id_fk" FOREIGN KEY ("designation_fk") REFERENCES "public"."designation_type"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "urm_expires_at_idx" ON "user_role_mapping" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "urm_assigned_by_idx" ON "user_role_mapping" USING btree ("assigned_by");--> statement-breakpoint
CREATE INDEX "communication_email_idx" ON "communication" USING btree ("email");--> statement-breakpoint
CREATE INDEX "communication_phone_idx" ON "communication" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "plan_price_plan_fk_idx" ON "plan_price" USING btree ("plan_fk");--> statement-breakpoint
CREATE INDEX "plan_price_currency_fk_idx" ON "plan_price" USING btree ("currency_fk");--> statement-breakpoint
CREATE INDEX "plan_price_frequency_fk_idx" ON "plan_price" USING btree ("frequency_fk");--> statement-breakpoint
CREATE INDEX "subscription_plan_fk_idx" ON "subscription" USING btree ("plan_fk");--> statement-breakpoint
CREATE INDEX "subscription_status_fk_idx" ON "subscription" USING btree ("status_fk");--> statement-breakpoint
CREATE INDEX "notifications_retry_idx" ON "notifications" USING btree ("status_fk","retry_count") WHERE status_fk IN (1, 5);--> statement-breakpoint
CREATE UNIQUE INDEX "staff_invite_pending_unique_idx" ON "staff_invite" USING btree ("store_fk","invitee_email") WHERE status_fk = 1 AND deleted_at IS NULL;