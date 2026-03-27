CREATE TABLE "otp_request_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"identifier" text NOT NULL,
	"request_count" smallint DEFAULT 1 NOT NULL,
	"window_expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "otp_request_log_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
ALTER TABLE "otp_verification" ADD COLUMN "auth_provider_fk" bigint;--> statement-breakpoint
CREATE INDEX "otp_request_log_identifier_idx" ON "otp_request_log" USING btree ("identifier");--> statement-breakpoint
ALTER TABLE "otp_verification" ADD CONSTRAINT "otp_verification_auth_provider_fk_user_auth_provider_id_fk" FOREIGN KEY ("auth_provider_fk") REFERENCES "public"."user_auth_provider"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_auth_provider_user_provider_unique" ON "user_auth_provider" USING btree ("user_fk","provider_id");--> statement-breakpoint
CREATE INDEX "otp_verification_auth_provider_idx" ON "otp_verification" USING btree ("auth_provider_fk");