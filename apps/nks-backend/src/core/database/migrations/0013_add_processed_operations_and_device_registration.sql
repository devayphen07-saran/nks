-- Phase 1 of the v5 sync implementation: idempotency cache + device
-- registration table. See future-implementation/sync-implementation-plan.md.

-- processed_operations: idempotency cache for POST /sync/push.
-- Keyed by clientOpId (UUID generated on the device). Only terminal results
-- (ok, duplicate, conflict, rejected) are written here; transient errors
-- and unknown-entity errors are intentionally NOT cached so retries succeed.
-- Daily cleanup deletes rows older than 90 days.
CREATE TABLE "processed_operations" (
	"client_op_id" uuid PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"result" jsonb NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "processed_operations_device_idx" ON "processed_operations" USING btree ("device_id","processed_at");--> statement-breakpoint
CREATE INDEX "processed_operations_processed_at_idx" ON "processed_operations" USING btree ("processed_at");--> statement-breakpoint

-- device_registration: links a stable mobile device UUID to a (user, store)
-- pair. Created as a side-effect of login when the request carries an
-- X-Device-Id header. The DeviceAuthGuard reads this table to gate every
-- /sync/* request. Cascading deletes: removing a user or store revokes
-- sync access for their devices automatically.
CREATE TABLE "device_registration" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"device_id" text NOT NULL,
	"user_fk" bigint NOT NULL,
	"store_fk" bigint NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_registration_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint

ALTER TABLE "device_registration" ADD CONSTRAINT "device_registration_user_fk_users_id_fk" FOREIGN KEY ("user_fk") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_registration" ADD CONSTRAINT "device_registration_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX "device_registration_device_user_store_uq" ON "device_registration" USING btree ("device_id","user_fk","store_fk");--> statement-breakpoint
CREATE INDEX "device_registration_user_idx" ON "device_registration" USING btree ("user_fk");