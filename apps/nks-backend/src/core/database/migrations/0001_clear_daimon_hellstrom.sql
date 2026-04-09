CREATE TABLE "lookup_type" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(30) NOT NULL,
	"title" varchar(50) NOT NULL,
	"description" varchar(150),
	"has_table" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"is_custom_table" boolean DEFAULT false,
	CONSTRAINT "lookup_type_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "otp_verification" DROP CONSTRAINT "otp_verification_auth_provider_fk_user_auth_provider_id_fk";
--> statement-breakpoint
ALTER TABLE "store" DROP CONSTRAINT "store_owner_user_fk_users_id_fk";
--> statement-breakpoint
ALTER TABLE "store" DROP CONSTRAINT "store_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "store" DROP CONSTRAINT "store_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "store" DROP CONSTRAINT "store_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "store_documents" DROP CONSTRAINT "store_documents_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "store_documents" DROP CONSTRAINT "store_documents_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "store_documents" DROP CONSTRAINT "store_documents_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "store_operating_hours" DROP CONSTRAINT "store_operating_hours_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "store_operating_hours" DROP CONSTRAINT "store_operating_hours_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "store_operating_hours" DROP CONSTRAINT "store_operating_hours_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "roles" DROP CONSTRAINT "roles_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "roles" DROP CONSTRAINT "roles_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "roles" DROP CONSTRAINT "roles_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "routes" DROP CONSTRAINT "routes_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "routes" DROP CONSTRAINT "routes_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "routes" DROP CONSTRAINT "routes_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "country" DROP CONSTRAINT "country_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "country" DROP CONSTRAINT "country_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "country" DROP CONSTRAINT "country_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "state" DROP CONSTRAINT "state_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "state" DROP CONSTRAINT "state_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "state" DROP CONSTRAINT "state_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "district" DROP CONSTRAINT "district_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "district" DROP CONSTRAINT "district_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "district" DROP CONSTRAINT "district_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "pincode" DROP CONSTRAINT "pincode_state_fk_state_id_fk";
--> statement-breakpoint
ALTER TABLE "pincode" DROP CONSTRAINT "pincode_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "pincode" DROP CONSTRAINT "pincode_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "pincode" DROP CONSTRAINT "pincode_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "address" DROP CONSTRAINT "address_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "address" DROP CONSTRAINT "address_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "address" DROP CONSTRAINT "address_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "address_type" DROP CONSTRAINT "address_type_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "address_type" DROP CONSTRAINT "address_type_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "address_type" DROP CONSTRAINT "address_type_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "commodity_codes" DROP CONSTRAINT "commodity_codes_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "commodity_codes" DROP CONSTRAINT "commodity_codes_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "commodity_codes" DROP CONSTRAINT "commodity_codes_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_agencies" DROP CONSTRAINT "tax_agencies_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_agencies" DROP CONSTRAINT "tax_agencies_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_agencies" DROP CONSTRAINT "tax_agencies_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_names" DROP CONSTRAINT "tax_names_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_names" DROP CONSTRAINT "tax_names_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_names" DROP CONSTRAINT "tax_names_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_levels" DROP CONSTRAINT "tax_levels_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_levels" DROP CONSTRAINT "tax_levels_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_levels" DROP CONSTRAINT "tax_levels_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_registrations" DROP CONSTRAINT "tax_registrations_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_registrations" DROP CONSTRAINT "tax_registrations_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_registrations" DROP CONSTRAINT "tax_registrations_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_registration_type" DROP CONSTRAINT "tax_registration_type_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_registration_type" DROP CONSTRAINT "tax_registration_type_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_registration_type" DROP CONSTRAINT "tax_registration_type_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_filing_frequency" DROP CONSTRAINT "tax_filing_frequency_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_filing_frequency" DROP CONSTRAINT "tax_filing_frequency_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_filing_frequency" DROP CONSTRAINT "tax_filing_frequency_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_line_status" DROP CONSTRAINT "tax_line_status_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_line_status" DROP CONSTRAINT "tax_line_status_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_line_status" DROP CONSTRAINT "tax_line_status_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_rate_master" DROP CONSTRAINT "tax_rate_master_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_rate_master" DROP CONSTRAINT "tax_rate_master_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_rate_master" DROP CONSTRAINT "tax_rate_master_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "daily_tax_summary" DROP CONSTRAINT "daily_tax_summary_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "daily_tax_summary" DROP CONSTRAINT "daily_tax_summary_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "daily_tax_summary" DROP CONSTRAINT "daily_tax_summary_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "code_category" DROP CONSTRAINT "code_category_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "code_category" DROP CONSTRAINT "code_category_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "code_category" DROP CONSTRAINT "code_category_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "code_value" DROP CONSTRAINT "code_value_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "code_value" DROP CONSTRAINT "code_value_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "code_value" DROP CONSTRAINT "code_value_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "lookup" DROP CONSTRAINT "lookup_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "lookup" DROP CONSTRAINT "lookup_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "lookup" DROP CONSTRAINT "lookup_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "salutation_type" DROP CONSTRAINT "salutation_type_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "salutation_type" DROP CONSTRAINT "salutation_type_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "salutation_type" DROP CONSTRAINT "salutation_type_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "designation_type" DROP CONSTRAINT "designation_type_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "designation_type" DROP CONSTRAINT "designation_type_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "designation_type" DROP CONSTRAINT "designation_type_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "store_legal_type" DROP CONSTRAINT "store_legal_type_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "store_legal_type" DROP CONSTRAINT "store_legal_type_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "store_legal_type" DROP CONSTRAINT "store_legal_type_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "store_category" DROP CONSTRAINT "store_category_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "store_category" DROP CONSTRAINT "store_category_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "store_category" DROP CONSTRAINT "store_category_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "communication_type" DROP CONSTRAINT "communication_type_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "communication_type" DROP CONSTRAINT "communication_type_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "communication_type" DROP CONSTRAINT "communication_type_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "contact_person_type" DROP CONSTRAINT "contact_person_type_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "contact_person_type" DROP CONSTRAINT "contact_person_type_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "contact_person_type" DROP CONSTRAINT "contact_person_type_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "notes_type" DROP CONSTRAINT "notes_type_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "notes_type" DROP CONSTRAINT "notes_type_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "notes_type" DROP CONSTRAINT "notes_type_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "volumes" DROP CONSTRAINT "volumes_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "volumes" DROP CONSTRAINT "volumes_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "volumes" DROP CONSTRAINT "volumes_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "currency" DROP CONSTRAINT "currency_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "currency" DROP CONSTRAINT "currency_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "currency" DROP CONSTRAINT "currency_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "billing_frequency" DROP CONSTRAINT "billing_frequency_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "billing_frequency" DROP CONSTRAINT "billing_frequency_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "billing_frequency" DROP CONSTRAINT "billing_frequency_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "plan_type" DROP CONSTRAINT "plan_type_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "plan_type" DROP CONSTRAINT "plan_type_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "plan_type" DROP CONSTRAINT "plan_type_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "entity_type" DROP CONSTRAINT "entity_type_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "entity_type" DROP CONSTRAINT "entity_type_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "entity_type" DROP CONSTRAINT "entity_type_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "notification_status" DROP CONSTRAINT "notification_status_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "notification_status" DROP CONSTRAINT "notification_status_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "notification_status" DROP CONSTRAINT "notification_status_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "staff_invite_status" DROP CONSTRAINT "staff_invite_status_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "staff_invite_status" DROP CONSTRAINT "staff_invite_status_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "staff_invite_status" DROP CONSTRAINT "staff_invite_status_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "status" DROP CONSTRAINT "status_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "status" DROP CONSTRAINT "status_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "status" DROP CONSTRAINT "status_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "entity" DROP CONSTRAINT "entity_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "entity" DROP CONSTRAINT "entity_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "entity" DROP CONSTRAINT "entity_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "communication" DROP CONSTRAINT "communication_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "communication" DROP CONSTRAINT "communication_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "communication" DROP CONSTRAINT "communication_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "contact_person" DROP CONSTRAINT "contact_person_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "contact_person" DROP CONSTRAINT "contact_person_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "contact_person" DROP CONSTRAINT "contact_person_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "notes" DROP CONSTRAINT "notes_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "notes" DROP CONSTRAINT "notes_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "notes" DROP CONSTRAINT "notes_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "staff_invite" DROP CONSTRAINT "staff_invite_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "staff_invite" DROP CONSTRAINT "staff_invite_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "staff_invite" DROP CONSTRAINT "staff_invite_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "plans" DROP CONSTRAINT "plans_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "plans" DROP CONSTRAINT "plans_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "plans" DROP CONSTRAINT "plans_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "plan_price" DROP CONSTRAINT "plan_price_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "plan_price" DROP CONSTRAINT "plan_price_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "plan_price" DROP CONSTRAINT "plan_price_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "subscription" DROP CONSTRAINT "subscription_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "subscription" DROP CONSTRAINT "subscription_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "subscription" DROP CONSTRAINT "subscription_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "subscription_item" DROP CONSTRAINT "subscription_item_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "subscription_item" DROP CONSTRAINT "subscription_item_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "subscription_item" DROP CONSTRAINT "subscription_item_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_preferences" DROP CONSTRAINT "user_preferences_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_preferences" DROP CONSTRAINT "user_preferences_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_preferences" DROP CONSTRAINT "user_preferences_deleted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "system_config" DROP CONSTRAINT "system_config_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "system_config" DROP CONSTRAINT "system_config_modified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "system_config" DROP CONSTRAINT "system_config_deleted_by_users_id_fk";
--> statement-breakpoint
DROP INDEX "pincode_state_idx";--> statement-breakpoint
ALTER TABLE "pincode" ALTER COLUMN "latitude" SET DATA TYPE numeric(9, 7);--> statement-breakpoint
ALTER TABLE "address" ALTER COLUMN "city_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tax_rate_master" ALTER COLUMN "effective_from" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tax_rate_master" ALTER COLUMN "effective_to" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription" ALTER COLUMN "first_invoice_recorded_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription" ALTER COLUMN "trial_end" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription_item" ALTER COLUMN "effective_from" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription_item" ALTER COLUMN "effective_to" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_session" ADD COLUMN "ip_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "user_session" ADD COLUMN "revoked_reason" varchar(50);--> statement-breakpoint
ALTER TABLE "lookup" ADD COLUMN "lookup_type_fk" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_verification" ADD CONSTRAINT "otp_verification_auth_provider_fk_user_auth_provider_id_fk" FOREIGN KEY ("auth_provider_fk") REFERENCES "public"."user_auth_provider"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_owner_user_fk_users_id_fk" FOREIGN KEY ("owner_user_fk") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_documents" ADD CONSTRAINT "store_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_documents" ADD CONSTRAINT "store_documents_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_documents" ADD CONSTRAINT "store_documents_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_operating_hours" ADD CONSTRAINT "store_operating_hours_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_operating_hours" ADD CONSTRAINT "store_operating_hours_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_operating_hours" ADD CONSTRAINT "store_operating_hours_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "country" ADD CONSTRAINT "country_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "country" ADD CONSTRAINT "country_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "country" ADD CONSTRAINT "country_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state" ADD CONSTRAINT "state_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state" ADD CONSTRAINT "state_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state" ADD CONSTRAINT "state_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "district" ADD CONSTRAINT "district_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "district" ADD CONSTRAINT "district_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "district" ADD CONSTRAINT "district_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pincode" ADD CONSTRAINT "pincode_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pincode" ADD CONSTRAINT "pincode_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pincode" ADD CONSTRAINT "pincode_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address_type" ADD CONSTRAINT "address_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address_type" ADD CONSTRAINT "address_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address_type" ADD CONSTRAINT "address_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commodity_codes" ADD CONSTRAINT "commodity_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commodity_codes" ADD CONSTRAINT "commodity_codes_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commodity_codes" ADD CONSTRAINT "commodity_codes_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_agencies" ADD CONSTRAINT "tax_agencies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_agencies" ADD CONSTRAINT "tax_agencies_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_agencies" ADD CONSTRAINT "tax_agencies_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_names" ADD CONSTRAINT "tax_names_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_names" ADD CONSTRAINT "tax_names_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_names" ADD CONSTRAINT "tax_names_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_levels" ADD CONSTRAINT "tax_levels_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_levels" ADD CONSTRAINT "tax_levels_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_levels" ADD CONSTRAINT "tax_levels_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_registrations" ADD CONSTRAINT "tax_registrations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_registrations" ADD CONSTRAINT "tax_registrations_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_registrations" ADD CONSTRAINT "tax_registrations_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_registration_type" ADD CONSTRAINT "tax_registration_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_registration_type" ADD CONSTRAINT "tax_registration_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_registration_type" ADD CONSTRAINT "tax_registration_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_filing_frequency" ADD CONSTRAINT "tax_filing_frequency_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_filing_frequency" ADD CONSTRAINT "tax_filing_frequency_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_filing_frequency" ADD CONSTRAINT "tax_filing_frequency_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_line_status" ADD CONSTRAINT "tax_line_status_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_line_status" ADD CONSTRAINT "tax_line_status_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_line_status" ADD CONSTRAINT "tax_line_status_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD CONSTRAINT "tax_rate_master_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD CONSTRAINT "tax_rate_master_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD CONSTRAINT "tax_rate_master_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tax_summary" ADD CONSTRAINT "daily_tax_summary_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tax_summary" ADD CONSTRAINT "daily_tax_summary_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tax_summary" ADD CONSTRAINT "daily_tax_summary_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_category" ADD CONSTRAINT "code_category_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_category" ADD CONSTRAINT "code_category_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_category" ADD CONSTRAINT "code_category_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_value" ADD CONSTRAINT "code_value_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_value" ADD CONSTRAINT "code_value_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_value" ADD CONSTRAINT "code_value_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lookup" ADD CONSTRAINT "lookup_lookup_type_fk_lookup_type_id_fk" FOREIGN KEY ("lookup_type_fk") REFERENCES "public"."lookup_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lookup" ADD CONSTRAINT "lookup_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lookup" ADD CONSTRAINT "lookup_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lookup" ADD CONSTRAINT "lookup_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salutation_type" ADD CONSTRAINT "salutation_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salutation_type" ADD CONSTRAINT "salutation_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salutation_type" ADD CONSTRAINT "salutation_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designation_type" ADD CONSTRAINT "designation_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designation_type" ADD CONSTRAINT "designation_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designation_type" ADD CONSTRAINT "designation_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_legal_type" ADD CONSTRAINT "store_legal_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_legal_type" ADD CONSTRAINT "store_legal_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_legal_type" ADD CONSTRAINT "store_legal_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_category" ADD CONSTRAINT "store_category_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_category" ADD CONSTRAINT "store_category_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_category" ADD CONSTRAINT "store_category_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_type" ADD CONSTRAINT "communication_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_type" ADD CONSTRAINT "communication_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_type" ADD CONSTRAINT "communication_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person_type" ADD CONSTRAINT "contact_person_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person_type" ADD CONSTRAINT "contact_person_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person_type" ADD CONSTRAINT "contact_person_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes_type" ADD CONSTRAINT "notes_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes_type" ADD CONSTRAINT "notes_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes_type" ADD CONSTRAINT "notes_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volumes" ADD CONSTRAINT "volumes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volumes" ADD CONSTRAINT "volumes_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volumes" ADD CONSTRAINT "volumes_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "currency" ADD CONSTRAINT "currency_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "currency" ADD CONSTRAINT "currency_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "currency" ADD CONSTRAINT "currency_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_frequency" ADD CONSTRAINT "billing_frequency_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_frequency" ADD CONSTRAINT "billing_frequency_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_frequency" ADD CONSTRAINT "billing_frequency_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_type" ADD CONSTRAINT "plan_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_type" ADD CONSTRAINT "plan_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_type" ADD CONSTRAINT "plan_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_type" ADD CONSTRAINT "entity_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_type" ADD CONSTRAINT "entity_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_type" ADD CONSTRAINT "entity_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_status" ADD CONSTRAINT "notification_status_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_status" ADD CONSTRAINT "notification_status_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_status" ADD CONSTRAINT "notification_status_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite_status" ADD CONSTRAINT "staff_invite_status_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite_status" ADD CONSTRAINT "staff_invite_status_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite_status" ADD CONSTRAINT "staff_invite_status_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status" ADD CONSTRAINT "status_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status" ADD CONSTRAINT "status_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status" ADD CONSTRAINT "status_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity" ADD CONSTRAINT "entity_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity" ADD CONSTRAINT "entity_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity" ADD CONSTRAINT "entity_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication" ADD CONSTRAINT "communication_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication" ADD CONSTRAINT "communication_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication" ADD CONSTRAINT "communication_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person" ADD CONSTRAINT "contact_person_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person" ADD CONSTRAINT "contact_person_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person" ADD CONSTRAINT "contact_person_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite" ADD CONSTRAINT "staff_invite_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite" ADD CONSTRAINT "staff_invite_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite" ADD CONSTRAINT "staff_invite_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_price" ADD CONSTRAINT "plan_price_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_price" ADD CONSTRAINT "plan_price_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_price" ADD CONSTRAINT "plan_price_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_item" ADD CONSTRAINT "subscription_item_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_item" ADD CONSTRAINT "subscription_item_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_item" ADD CONSTRAINT "subscription_item_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_config" ADD CONSTRAINT "system_config_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_config" ADD CONSTRAINT "system_config_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_config" ADD CONSTRAINT "system_config_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "store_parent_store_idx" ON "store" USING btree ("parent_store_fk");--> statement-breakpoint
CREATE INDEX "lookup_type_fk_idx" ON "lookup" USING btree ("lookup_type_fk");--> statement-breakpoint
CREATE INDEX "plans_allow_to_upgrade_idx" ON "plans" USING btree ("allow_to_upgrade_fk");--> statement-breakpoint
CREATE INDEX "plans_allow_to_downgrade_idx" ON "plans" USING btree ("allow_to_downgrade_fk");--> statement-breakpoint
ALTER TABLE "pincode" DROP COLUMN "state_fk";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_contact_method_chk" CHECK (email IS NOT NULL OR phone_number IS NOT NULL);