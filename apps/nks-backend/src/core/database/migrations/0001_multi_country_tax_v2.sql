CREATE TYPE "public"."commodity_code_type" AS ENUM('HSN', 'SAC', 'HS', 'CN', 'UNSPSC');--> statement-breakpoint
CREATE TYPE "public"."commodity_digits" AS ENUM('4', '6', '8', '10');--> statement-breakpoint
CREATE TYPE "public"."registration_type" AS ENUM('REGULAR', 'COMPOSITION');--> statement-breakpoint
CREATE TABLE "commodity_codes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"country_fk" bigint NOT NULL,
	"type" "commodity_code_type" NOT NULL,
	"code" varchar(10) NOT NULL,
	"digits" "commodity_digits",
	"description" varchar(1000) NOT NULL,
	"display_name" varchar(255),
	"default_tax_rate" numeric(10, 3) DEFAULT '0' NOT NULL,
	"is_exempted" boolean DEFAULT false NOT NULL,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "commodity_codes_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
ALTER TABLE "hsn_codes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "hsn_codes" CASCADE;--> statement-breakpoint

DROP INDEX "transaction_tax_lines_hsn_idx";--> statement-breakpoint
DROP INDEX "tax_rate_master_active_idx";--> statement-breakpoint
DROP INDEX "daily_tax_summary_store_date_rate_unique";--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ALTER COLUMN "tax_registration_fk" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tax_registrations" ADD COLUMN "region_code" varchar(20);--> statement-breakpoint
ALTER TABLE "tax_registrations" ADD COLUMN "registration_type" "registration_type" DEFAULT 'REGULAR' NOT NULL;--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD COLUMN "country_fk" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD COLUMN "commodity_code_fk" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD COLUMN "base_tax_rate" numeric(10, 3) NOT NULL;--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD COLUMN "component1_rate" numeric(10, 3);--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD COLUMN "component2_rate" numeric(10, 3);--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD COLUMN "component3_rate" numeric(10, 3);--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD COLUMN "additional_rate" numeric(10, 3) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "daily_tax_summary" ADD COLUMN "country_fk" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_tax_summary" ADD COLUMN "tax_rate" numeric(10, 3) NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_tax_summary" ADD COLUMN "total_component1_amount" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_tax_summary" ADD COLUMN "total_component2_amount" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_tax_summary" ADD COLUMN "total_component3_amount" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "daily_tax_summary" ADD COLUMN "total_additional_amount" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "daily_tax_summary" ADD COLUMN "total_tax_collected" numeric(15, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD COLUMN "country_fk" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD COLUMN "commodity_code_fk" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD COLUMN "component1_amount" numeric(15, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD COLUMN "component2_amount" numeric(15, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD COLUMN "component3_amount" numeric(15, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD COLUMN "component4_amount" numeric(15, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD COLUMN "additional_amount" numeric(15, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD COLUMN "total_tax_amount" numeric(15, 3) NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD COLUMN "irn" varchar(64);--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD COLUMN "qr_code_url" varchar(2048);--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD COLUMN "applied_tax_rate" numeric(10, 3) NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD COLUMN "created_by" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD COLUMN "approved_by" bigint;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "commodity_codes" ADD CONSTRAINT "commodity_codes_country_fk_country_id_fk" FOREIGN KEY ("country_fk") REFERENCES "public"."country"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commodity_codes" ADD CONSTRAINT "commodity_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commodity_codes" ADD CONSTRAINT "commodity_codes_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commodity_codes" ADD CONSTRAINT "commodity_codes_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "commodity_codes_code_country_type_unique" ON "commodity_codes" USING btree ("code","country_fk","type");--> statement-breakpoint
CREATE INDEX "commodity_codes_type_code_idx" ON "commodity_codes" USING btree ("type","code");--> statement-breakpoint
CREATE INDEX "commodity_codes_digits_idx" ON "commodity_codes" USING btree ("digits");--> statement-breakpoint
CREATE INDEX "commodity_codes_country_idx" ON "commodity_codes" USING btree ("country_fk");--> statement-breakpoint
CREATE INDEX "commodity_codes_country_type_idx" ON "commodity_codes" USING btree ("country_fk","type");--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD CONSTRAINT "tax_rate_master_country_fk_country_id_fk" FOREIGN KEY ("country_fk") REFERENCES "public"."country"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD CONSTRAINT "tax_rate_master_commodity_code_fk_commodity_codes_id_fk" FOREIGN KEY ("commodity_code_fk") REFERENCES "public"."commodity_codes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tax_summary" ADD CONSTRAINT "daily_tax_summary_country_fk_country_id_fk" FOREIGN KEY ("country_fk") REFERENCES "public"."country"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD CONSTRAINT "transaction_tax_lines_country_fk_country_id_fk" FOREIGN KEY ("country_fk") REFERENCES "public"."country"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD CONSTRAINT "transaction_tax_lines_commodity_code_fk_commodity_codes_id_fk" FOREIGN KEY ("commodity_code_fk") REFERENCES "public"."commodity_codes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD CONSTRAINT "transaction_tax_lines_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD CONSTRAINT "transaction_tax_lines_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tax_registrations_number_country_idx" ON "tax_registrations" USING btree ("registration_number","country_fk");--> statement-breakpoint
CREATE INDEX "tax_registrations_country_idx" ON "tax_registrations" USING btree ("country_fk");--> statement-breakpoint
CREATE INDEX "tax_rate_master_country_idx" ON "tax_rate_master" USING btree ("country_fk");--> statement-breakpoint
CREATE INDEX "tax_rate_master_commodity_idx" ON "tax_rate_master" USING btree ("commodity_code_fk");--> statement-breakpoint
CREATE INDEX "daily_tax_summary_country_idx" ON "daily_tax_summary" USING btree ("country_fk");--> statement-breakpoint
CREATE INDEX "daily_tax_summary_store_date_idx" ON "daily_tax_summary" USING btree ("store_fk","transaction_date");--> statement-breakpoint
CREATE INDEX "daily_tax_summary_date_idx" ON "daily_tax_summary" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "daily_tax_summary_rate_idx" ON "daily_tax_summary" USING btree ("tax_rate");--> statement-breakpoint
CREATE INDEX "transaction_tax_lines_country_idx" ON "transaction_tax_lines" USING btree ("country_fk");--> statement-breakpoint
CREATE INDEX "transaction_tax_lines_commodity_idx" ON "transaction_tax_lines" USING btree ("commodity_code_fk");--> statement-breakpoint
CREATE INDEX "transaction_tax_lines_country_store_commodity_date_idx" ON "transaction_tax_lines" USING btree ("country_fk","store_fk","commodity_code_fk","transaction_date");--> statement-breakpoint
CREATE INDEX "transaction_tax_lines_country_store_rate_date_idx" ON "transaction_tax_lines" USING btree ("country_fk","store_fk","applied_tax_rate","transaction_date");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_rate_master_active_idx" ON "tax_rate_master" USING btree ("country_fk","store_fk","commodity_code_fk") WHERE is_active = true AND deleted_at IS NULL AND effective_to IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_tax_summary_store_date_rate_unique" ON "daily_tax_summary" USING btree ("country_fk","store_fk","transaction_date","tax_rate");--> statement-breakpoint
ALTER TABLE "tax_rate_master" DROP COLUMN "hsn_code_fk";--> statement-breakpoint
ALTER TABLE "tax_rate_master" DROP COLUMN "gst_rate";--> statement-breakpoint
ALTER TABLE "tax_rate_master" DROP COLUMN "cgst_rate";--> statement-breakpoint
ALTER TABLE "tax_rate_master" DROP COLUMN "sgst_rate";--> statement-breakpoint
ALTER TABLE "tax_rate_master" DROP COLUMN "igst_rate";--> statement-breakpoint
ALTER TABLE "tax_rate_master" DROP COLUMN "cess_rate";--> statement-breakpoint
ALTER TABLE "daily_tax_summary" DROP COLUMN "gst_rate";--> statement-breakpoint
ALTER TABLE "daily_tax_summary" DROP COLUMN "total_cgst";--> statement-breakpoint
ALTER TABLE "daily_tax_summary" DROP COLUMN "total_sgst";--> statement-breakpoint
ALTER TABLE "daily_tax_summary" DROP COLUMN "total_igst";--> statement-breakpoint
ALTER TABLE "daily_tax_summary" DROP COLUMN "total_cess";--> statement-breakpoint
ALTER TABLE "daily_tax_summary" DROP COLUMN "tax_collected";--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" DROP COLUMN "hsn_code_fk";--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" DROP COLUMN "cgst_amount";--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" DROP COLUMN "sgst_amount";--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" DROP COLUMN "igst_amount";--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" DROP COLUMN "cess_amount";--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" DROP COLUMN "total_tax";--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" DROP COLUMN "applied_gst_rate";--> statement-breakpoint
ALTER TABLE "tax_levels" ADD CONSTRAINT "tax_levels_rate_range_chk" CHECK (rate >= 0 AND rate <= 100);--> statement-breakpoint
ALTER TABLE "tax_registrations" ADD CONSTRAINT "tax_registrations_date_range_chk" CHECK (effective_from <= effective_to OR effective_to IS NULL);--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD CONSTRAINT "tax_rate_master_tax_rate_positive" CHECK (base_tax_rate >= 0);--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD CONSTRAINT "tax_rate_master_components_positive" CHECK ((component1_rate IS NULL OR component1_rate >= 0) AND (component2_rate IS NULL OR component2_rate >= 0) AND (component3_rate IS NULL OR component3_rate >= 0) AND additional_rate >= 0);--> statement-breakpoint
ALTER TABLE "daily_tax_summary" ADD CONSTRAINT "daily_tax_summary_tax_rate_positive_chk" CHECK (tax_rate >= 0);--> statement-breakpoint
ALTER TABLE "daily_tax_summary" ADD CONSTRAINT "daily_tax_summary_tax_collected_chk" CHECK (total_tax_collected = total_component1_amount + total_component2_amount + total_component3_amount + COALESCE(total_additional_amount, 0));--> statement-breakpoint
ALTER TABLE "daily_tax_summary" ADD CONSTRAINT "daily_tax_summary_amounts_positive_chk" CHECK (total_taxable_amount >= 0 AND total_component1_amount >= 0 AND total_component2_amount >= 0 AND total_component3_amount >= 0 AND total_tax_collected >= 0);--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD CONSTRAINT "transaction_tax_lines_total_tax_chk" CHECK (total_tax_amount = component1_amount + component2_amount + component3_amount + component4_amount + additional_amount);--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD CONSTRAINT "transaction_tax_lines_amounts_positive_chk" CHECK (taxable_amount >= 0 AND component1_amount >= 0 AND component2_amount >= 0 AND component3_amount >= 0 AND component4_amount >= 0 AND total_tax_amount >= 0);--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD CONSTRAINT "transaction_tax_lines_rate_positive_chk" CHECK (applied_tax_rate >= 0);