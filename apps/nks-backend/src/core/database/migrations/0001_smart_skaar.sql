CREATE TYPE "public"."auth_method" AS ENUM('OTP', 'PASSWORD', 'GOOGLE');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "primary_login_method" "auth_method";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_session" ADD COLUMN "login_method" "auth_method";--> statement-breakpoint
ALTER TABLE "user_auth_provider" ADD COLUMN "is_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_auth_provider" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "permissions" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "permissions" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "permissions" ADD COLUMN "sort_order" integer;--> statement-breakpoint
ALTER TABLE "permissions" ADD COLUMN "is_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "permissions" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "users_blocked_by_idx" ON "users" USING btree ("blocked_by");--> statement-breakpoint
CREATE INDEX "users_profile_completed_idx" ON "users" USING btree ("profile_completed");--> statement-breakpoint
CREATE INDEX "user_role_mapping_assigned_by_idx" ON "user_role_mapping" USING btree ("assigned_by");--> statement-breakpoint
CREATE INDEX "role_permission_mapping_permission_idx" ON "role_permission_mapping" USING btree ("permission_fk");--> statement-breakpoint
CREATE INDEX "role_permission_mapping_assigned_by_idx" ON "role_permission_mapping" USING btree ("assigned_by");--> statement-breakpoint
CREATE INDEX "role_route_mapping_route_idx" ON "role_route_mapping" USING btree ("route_fk");--> statement-breakpoint
CREATE INDEX "designation_store_fk_idx" ON "designation" USING btree ("store_fk");--> statement-breakpoint
CREATE INDEX "store_user_mapping_designation_idx" ON "store_user_mapping" USING btree ("designation_fk");--> statement-breakpoint
CREATE INDEX "store_user_mapping_assigned_by_idx" ON "store_user_mapping" USING btree ("assigned_by");