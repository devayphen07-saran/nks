CREATE TYPE "public"."audit_action_type" AS ENUM('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'TOKEN_REFRESH', 'TOKEN_REVOKE', 'PASSWORD_RESET', 'EMAIL_VERIFIED', 'PHONE_VERIFIED', 'OTP_REQUESTED', 'OTP_VERIFIED', 'OTP_FAILED', 'INVITE_SENT', 'INVITE_ACCEPTED', 'INVITE_REVOKED', 'ROLE_ASSIGNED', 'ROLE_REVOKED', 'PERMISSION_GRANTED', 'PERMISSION_REVOKED', 'STORE_CREATED', 'STORE_DELETED', 'ACCOUNT_BLOCKED', 'ACCOUNT_UNBLOCKED');--> statement-breakpoint
CREATE TYPE "public"."auth_method" AS ENUM('OTP', 'PASSWORD', 'GOOGLE');--> statement-breakpoint
CREATE TYPE "public"."device_type" AS ENUM('IOS', 'ANDROID');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('WEBSOCKET', 'PUSH', 'BOTH');--> statement-breakpoint
CREATE TYPE "public"."notification_template_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('LOGIN', 'PHONE_VERIFY', 'EMAIL_VERIFY', 'RESET_PASSWORD');--> statement-breakpoint
CREATE TYPE "public"."route_scope" AS ENUM('admin', 'store');--> statement-breakpoint
CREATE TYPE "public"."route_type" AS ENUM('sidebar', 'tab', 'screen', 'modal');--> statement-breakpoint
CREATE TYPE "public"."session_device_type" AS ENUM('IOS', 'ANDROID', 'WEB');--> statement-breakpoint
CREATE TYPE "public"."store_status" AS ENUM('ACTIVE', 'SUSPENDED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."volume_type" AS ENUM('weight', 'volume', 'length', 'count', 'area');--> statement-breakpoint
CREATE TYPE "public"."store_document_type" AS ENUM('GST_CERT', 'TRADE_LICENSE', 'PAN', 'UDYAM', 'FOOD_LICENSE', 'DRUG_LICENSE', 'SHOP_ACT_LICENSE', 'FIRE_SAFETY_CERT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."commodity_code_type" AS ENUM('HSN', 'SAC', 'HS', 'CN', 'UNSPSC');--> statement-breakpoint
CREATE TYPE "public"."commodity_digits" AS ENUM('4', '6', '8', '10');--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"iam_user_id" varchar(64),
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"phone_number" varchar(20),
	"phone_number_verified" boolean DEFAULT false NOT NULL,
	"kyc_level" smallint DEFAULT 0 NOT NULL,
	"language_preference" varchar(5) DEFAULT 'en' NOT NULL,
	"whatsapp_opted_in" boolean DEFAULT true NOT NULL,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"blocked_reason" text,
	"blocked_at" timestamp with time zone,
	"account_locked_until" timestamp with time zone,
	"blocked_by" bigint,
	"primary_login_method" "auth_method",
	"login_count" integer DEFAULT 0 NOT NULL,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"last_login_at" timestamp with time zone,
	"last_active_at" timestamp with time zone,
	"profile_completed" boolean DEFAULT false NOT NULL,
	"profile_completed_at" timestamp with time zone,
	"permissions_version" varchar(20) DEFAULT 'v1' NOT NULL,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "users_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "users_iam_user_id_unique" UNIQUE("iam_user_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE "user_session" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" varchar(50),
	"user_agent" text,
	"user_fk" bigint NOT NULL,
	"device_id" varchar(100),
	"device_name" varchar(100),
	"device_type" "session_device_type",
	"platform" varchar(20),
	"app_version" varchar(20),
	"login_method" "auth_method",
	"active_store_fk" bigint,
	"refresh_token_hash" varchar(64),
	"refresh_token_expires_at" timestamp with time zone,
	"access_token_expires_at" timestamp with time zone,
	"role_hash" varchar(64),
	"refresh_token_revoked_at" timestamp with time zone,
	"is_refresh_token_rotated" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_session_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "user_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user_auth_provider" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_fk" bigint NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	CONSTRAINT "user_auth_provider_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
CREATE TABLE "otp_verification" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"purpose" "otp_purpose" NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"is_used" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"auth_provider_fk" bigint,
	CONSTRAINT "otp_verification_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
CREATE TABLE "otp_request_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"identifier_hash" text NOT NULL,
	"request_count" smallint DEFAULT 1 NOT NULL,
	"window_expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "otp_request_log_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
CREATE TABLE "user_role_mapping" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"user_fk" bigint NOT NULL,
	"role_fk" bigint NOT NULL,
	"store_fk" bigint,
	"is_primary" boolean DEFAULT false NOT NULL,
	"assigned_by" bigint,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_role_mapping_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
CREATE TABLE "store" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"iam_store_id" varchar(64),
	"store_name" varchar(255) NOT NULL,
	"store_code" varchar(50),
	"owner_user_fk" bigint,
	"store_legal_type_fk" bigint NOT NULL,
	"store_category_fk" bigint NOT NULL,
	"registration_number" varchar(100),
	"tax_number" varchar(100),
	"kyc_level" smallint DEFAULT 0 NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"store_status" "store_status" DEFAULT 'ACTIVE' NOT NULL,
	"country_fk" bigint,
	"timezone" varchar(60) DEFAULT 'UTC' NOT NULL,
	"default_tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"logo_url" text,
	"parent_store_fk" bigint,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "store_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "store_iam_store_id_unique" UNIQUE("iam_store_id"),
	CONSTRAINT "store_store_code_unique" UNIQUE("store_code"),
	CONSTRAINT "store_status_active_sync_chk" CHECK ((store_status = 'ACTIVE') = is_active)
);
--> statement-breakpoint
CREATE TABLE "store_user_mapping" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"store_fk" bigint NOT NULL,
	"user_fk" bigint NOT NULL,
	"designation_fk" bigint,
	"joined_date" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "store_user_mapping_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
CREATE TABLE "store_documents" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"store_fk" bigint NOT NULL,
	"document_type" "store_document_type" NOT NULL,
	"document_number" varchar(100) NOT NULL,
	"document_url" text,
	"expiry_date" date,
	"is_verified" boolean DEFAULT false NOT NULL,
	"uploaded_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "store_documents_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
CREATE TABLE "store_operating_hours" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"store_fk" bigint NOT NULL,
	"day_of_week" smallint NOT NULL,
	"shift_number" smallint DEFAULT 1 NOT NULL,
	"shift_name" varchar(50),
	"opening_time" time,
	"closing_time" time,
	"is_closed" boolean DEFAULT false NOT NULL,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "store_operating_hours_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "store_operating_hours_unique_idx" UNIQUE("store_fk","day_of_week","shift_number"),
	CONSTRAINT "store_operating_hours_time_validity_chk" CHECK (
        (is_closed = true AND opening_time IS NULL AND closing_time IS NULL)
        OR
        (is_closed = false AND opening_time IS NOT NULL AND closing_time IS NOT NULL AND opening_time < closing_time)
      )
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(30) NOT NULL,
	"role_name" varchar(50) NOT NULL,
	"description" varchar(250),
	"store_fk" bigint,
	"is_editable" boolean DEFAULT true NOT NULL,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "roles_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"parent_route_fk" bigint,
	"route_name" varchar(100) NOT NULL,
	"route_path" varchar(200) NOT NULL,
	"full_path" varchar(400) DEFAULT '' NOT NULL,
	"description" varchar(255),
	"icon_name" varchar(80),
	"route_type" "route_type" DEFAULT 'screen' NOT NULL,
	"route_scope" "route_scope" DEFAULT 'admin' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "routes_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
CREATE TABLE "role_route_mapping" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role_fk" bigint NOT NULL,
	"route_fk" bigint NOT NULL,
	"allow" boolean DEFAULT true NOT NULL,
	"deny" boolean DEFAULT false NOT NULL,
	"can_view" boolean DEFAULT true NOT NULL,
	"can_create" boolean DEFAULT false NOT NULL,
	"can_edit" boolean DEFAULT false NOT NULL,
	"can_delete" boolean DEFAULT false NOT NULL,
	"can_export" boolean DEFAULT false NOT NULL,
	"assigned_by" bigint,
	CONSTRAINT "role_route_mapping_unique_idx" UNIQUE("role_fk","route_fk")
);
--> statement-breakpoint
CREATE TABLE "role_entity_permission" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"role_fk" bigint NOT NULL,
	"entity_type_fk" bigint NOT NULL,
	"can_view" boolean DEFAULT false NOT NULL,
	"can_create" boolean DEFAULT false NOT NULL,
	"can_edit" boolean DEFAULT false NOT NULL,
	"can_delete" boolean DEFAULT false NOT NULL,
	"deny" boolean DEFAULT false NOT NULL,
	CONSTRAINT "role_entity_permission_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "role_entity_permission_unique_idx" UNIQUE("role_fk","entity_type_fk")
);
--> statement-breakpoint
CREATE TABLE "country" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"country_name" varchar(100) NOT NULL,
	"description" varchar(255),
	"iso_code2" char(2) NOT NULL,
	"dial_code" varchar(10),
	"currency_code" varchar(10),
	"currency_symbol" varchar(10),
	"timezone" varchar(50),
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "country_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "country_country_name_unique" UNIQUE("country_name"),
	CONSTRAINT "country_iso_code2_unique" UNIQUE("iso_code2")
);
--> statement-breakpoint
CREATE TABLE "state" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"state_name" varchar(100) NOT NULL,
	"state_code" varchar(10) NOT NULL,
	"gst_state_code" varchar(2),
	"is_union_territory" boolean DEFAULT false NOT NULL,
	"description" varchar(255),
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "state_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
CREATE TABLE "district" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"district_name" varchar(100) NOT NULL,
	"district_code" varchar(20),
	"lgd_code" varchar(10),
	"state_fk" bigint NOT NULL,
	"description" varchar(255),
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "district_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
CREATE TABLE "pincode" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(6) NOT NULL,
	"locality_name" varchar(150) NOT NULL,
	"area_name" varchar(150),
	"district_fk" bigint NOT NULL,
	"state_fk" bigint NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "pincode_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
CREATE TABLE "address" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"entity_fk" bigint NOT NULL,
	"record_id" bigint NOT NULL,
	"address_type_fk" bigint NOT NULL,
	"line1" varchar(255) NOT NULL,
	"line2" varchar(255),
	"city_name" varchar(150),
	"state_fk" bigint,
	"district_fk" bigint,
	"pincode_fk" bigint,
	"is_billing_address" boolean DEFAULT false NOT NULL,
	"is_default_address" boolean DEFAULT false NOT NULL,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "address_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
CREATE TABLE "address_type" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(30) NOT NULL,
	"label" varchar(100) NOT NULL,
	"description" text,
	"is_shipping_applicable" boolean DEFAULT true,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "address_type_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "address_type_code_unique" UNIQUE("code")
);
--> statement-breakpoint
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
CREATE TABLE "tax_agencies" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"country_fk" bigint,
	"description" varchar(1000),
	"reference_url" varchar(500),
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "tax_agencies_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "tax_agencies_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "tax_names" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(50) NOT NULL,
	"tax_name" varchar(255) NOT NULL,
	"tax_agency_fk" bigint NOT NULL,
	"description" varchar(1000),
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "tax_names_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "tax_names_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "tax_levels" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"rate" numeric(10, 3) NOT NULL,
	"description" varchar(1000),
	"tax_name_fk" bigint NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "tax_levels_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "tax_levels_code_unique" UNIQUE("code"),
	CONSTRAINT "tax_levels_rate_range_chk" CHECK (rate >= 0 AND rate <= 100)
);
--> statement-breakpoint
CREATE TABLE "tax_level_mapping" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tax_agency_fk" bigint NOT NULL,
	"tax_name_fk" bigint NOT NULL,
	"tax_level_fk" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_registrations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"store_fk" bigint NOT NULL,
	"country_fk" bigint NOT NULL,
	"tax_agency_fk" bigint NOT NULL,
	"tax_name_fk" bigint NOT NULL,
	"registration_number" varchar(100) NOT NULL,
	"region_code" varchar(20),
	"registration_type_fk" bigint NOT NULL,
	"label" varchar(255),
	"filing_frequency_fk" bigint NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "tax_registrations_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "tax_registrations_date_range_chk" CHECK (effective_from <= effective_to OR effective_to IS NULL)
);
--> statement-breakpoint
CREATE TABLE "tax_registration_type" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(30) NOT NULL,
	"label" varchar(100) NOT NULL,
	"description" text,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "tax_registration_type_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "tax_registration_type_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "tax_filing_frequency" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(30) NOT NULL,
	"label" varchar(100) NOT NULL,
	"description" text,
	"filing_days" integer NOT NULL,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "tax_filing_frequency_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "tax_filing_frequency_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "tax_line_status" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(30) NOT NULL,
	"label" varchar(100) NOT NULL,
	"description" text,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "tax_line_status_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "tax_line_status_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "tax_rate_master" (
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
	"store_fk" bigint NOT NULL,
	"commodity_code_fk" bigint NOT NULL,
	"base_tax_rate" numeric(10, 3) NOT NULL,
	"component1_rate" numeric(10, 3),
	"component2_rate" numeric(10, 3),
	"component3_rate" numeric(10, 3),
	"additional_rate" numeric(10, 3) DEFAULT '0',
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "tax_rate_master_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "tax_rate_master_tax_rate_positive" CHECK (base_tax_rate >= 0),
	CONSTRAINT "tax_rate_master_date_range_chk" CHECK (effective_from <= effective_to OR effective_to IS NULL),
	CONSTRAINT "tax_rate_master_components_positive" CHECK ((component1_rate IS NULL OR component1_rate >= 0) AND (component2_rate IS NULL OR component2_rate >= 0) AND (component3_rate IS NULL OR component3_rate >= 0) AND additional_rate >= 0),
	CONSTRAINT "tax_rate_master_component_sum_chk" CHECK (base_tax_rate = COALESCE(component1_rate, 0) + COALESCE(component2_rate, 0) + COALESCE(component3_rate, 0) + COALESCE(additional_rate, 0))
);
--> statement-breakpoint
CREATE TABLE "daily_tax_summary" (
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
	"store_fk" bigint NOT NULL,
	"transaction_date" date NOT NULL,
	"tax_rate" numeric(10, 3) NOT NULL,
	"total_taxable_amount" numeric(15, 2) NOT NULL,
	"total_cgst_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_sgst_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_igst_amount" numeric(15, 2) DEFAULT '0',
	"total_cess_amount" numeric(15, 2) DEFAULT '0',
	"total_tax_collected" numeric(15, 2) NOT NULL,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "daily_tax_summary_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "daily_tax_summary_tax_rate_positive_chk" CHECK (tax_rate >= 0),
	CONSTRAINT "daily_tax_summary_tax_collected_chk" CHECK (total_tax_collected = total_cgst_amount + total_sgst_amount + COALESCE(total_igst_amount, 0) + COALESCE(total_cess_amount, 0)),
	CONSTRAINT "daily_tax_summary_amounts_positive_chk" CHECK (total_taxable_amount >= 0 AND total_cgst_amount >= 0 AND total_sgst_amount >= 0 AND total_tax_collected >= 0)
);
--> statement-breakpoint
CREATE TABLE "transaction_tax_lines" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"country_fk" bigint NOT NULL,
	"store_fk" bigint NOT NULL,
	"tax_registration_fk" bigint NOT NULL,
	"commodity_code_fk" bigint NOT NULL,
	"tax_rate_master_fk" bigint,
	"transaction_ref" bigint NOT NULL,
	"transaction_item_ref" bigint,
	"transaction_date" date NOT NULL,
	"taxable_amount" numeric(15, 3) NOT NULL,
	"cgst_amount" numeric(15, 3) DEFAULT '0' NOT NULL,
	"sgst_amount" numeric(15, 3) DEFAULT '0' NOT NULL,
	"igst_amount" numeric(15, 3) DEFAULT '0' NOT NULL,
	"utgst_amount" numeric(15, 3) DEFAULT '0' NOT NULL,
	"cess_amount" numeric(15, 3) DEFAULT '0' NOT NULL,
	"total_tax_amount" numeric(15, 3) NOT NULL,
	"irn" varchar(64),
	"qr_code_url" varchar(2048),
	"applied_tax_rate" numeric(10, 3) NOT NULL,
	"created_by" bigint NOT NULL,
	"approval_status_fk" bigint NOT NULL,
	"approved_by" bigint,
	"approved_at" timestamp with time zone,
	CONSTRAINT "transaction_tax_lines_total_tax_chk" CHECK (total_tax_amount = cgst_amount + sgst_amount + igst_amount + utgst_amount + cess_amount),
	CONSTRAINT "transaction_tax_lines_amounts_positive_chk" CHECK (taxable_amount >= 0 AND cgst_amount >= 0 AND sgst_amount >= 0 AND igst_amount >= 0 AND utgst_amount >= 0 AND cess_amount >= 0 AND total_tax_amount >= 0),
	CONSTRAINT "transaction_tax_lines_rate_positive_chk" CHECK (applied_tax_rate >= 0)
);
--> statement-breakpoint
CREATE TABLE "code_category" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "code_category_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
CREATE TABLE "code_value" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"category_fk" bigint NOT NULL,
	"code" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"description" varchar(255),
	"store_fk" bigint,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "code_value_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
CREATE TABLE "lookup" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(30) NOT NULL,
	"title" varchar(50) NOT NULL,
	"description" varchar(100),
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "lookup_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "lookup_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "salutation_type" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(30) NOT NULL,
	"label" varchar(100) NOT NULL,
	"description" text,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "salutation_type_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "salutation_type_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "designation_type" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(30) NOT NULL,
	"label" varchar(100) NOT NULL,
	"description" text,
	"department" varchar(50),
	"reporting_level" integer,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "designation_type_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "designation_type_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "store_legal_type" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(30) NOT NULL,
	"label" varchar(100) NOT NULL,
	"description" text,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "store_legal_type_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "store_legal_type_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "store_category" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(30) NOT NULL,
	"label" varchar(100) NOT NULL,
	"description" text,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "store_category_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "store_category_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "communication_type" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(30) NOT NULL,
	"label" varchar(100) NOT NULL,
	"description" text,
	"icon" varchar(100),
	"validation_regex" varchar(255),
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "communication_type_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "communication_type_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "contact_person_type" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(30) NOT NULL,
	"label" varchar(100) NOT NULL,
	"description" text,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "contact_person_type_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "contact_person_type_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "notes_type" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"notes_type_name" varchar(50) NOT NULL,
	"notes_type_code" varchar(30) NOT NULL,
	"description" text,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "notes_type_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "notes_type_notes_type_name_unique" UNIQUE("notes_type_name"),
	CONSTRAINT "notes_type_notes_type_code_unique" UNIQUE("notes_type_code")
);
--> statement-breakpoint
CREATE TABLE "volumes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"volume_name" varchar(50) NOT NULL,
	"volume_code" varchar(20) NOT NULL,
	"volume_type" "volume_type" NOT NULL,
	"decimal_places" integer DEFAULT 0 NOT NULL,
	"base_volume_fk" bigint,
	"conversion_factor" numeric(18, 6),
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "volumes_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "volumes_volume_name_unique" UNIQUE("volume_name"),
	CONSTRAINT "volumes_volume_code_unique" UNIQUE("volume_code"),
	CONSTRAINT "volumes_conversion_both_or_neither_chk" CHECK ((base_volume_fk IS NULL) = (conversion_factor IS NULL)),
	CONSTRAINT "volumes_no_self_reference_chk" CHECK (base_volume_fk IS NULL OR base_volume_fk <> id)
);
--> statement-breakpoint
CREATE TABLE "currency" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(3) NOT NULL,
	"symbol" varchar(10) NOT NULL,
	"description" varchar(100),
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "currency_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "currency_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "billing_frequency" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(30) NOT NULL,
	"label" varchar(100) NOT NULL,
	"description" text,
	"days" integer NOT NULL,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "billing_frequency_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "billing_frequency_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "plan_type" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(30) NOT NULL,
	"label" varchar(100) NOT NULL,
	"description" text,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "plan_type_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "plan_type_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "entity_type" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"description" text,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "entity_type_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "entity_type_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "notification_status" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(30) NOT NULL,
	"label" varchar(100) NOT NULL,
	"description" text,
	"is_terminal" boolean DEFAULT false,
	"is_error" boolean DEFAULT false,
	"is_retryable" boolean DEFAULT false,
	"display_order" integer DEFAULT 0,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "notification_status_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "notification_status_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "staff_invite_status" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(30) NOT NULL,
	"label" varchar(100) NOT NULL,
	"description" text,
	"is_terminal" boolean DEFAULT false,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "staff_invite_status_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "staff_invite_status_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"user_fk" bigint NOT NULL,
	"store_fk" bigint,
	"type_fk" bigint NOT NULL,
	"template_fk" bigint,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"data" jsonb,
	"status_fk" bigint NOT NULL,
	"failure_reason" text,
	"retry_count" smallint DEFAULT 0 NOT NULL,
	"max_retries" smallint DEFAULT 3 NOT NULL,
	"expires_at" timestamp with time zone,
	"expo_push_ticket_id" varchar(255),
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	CONSTRAINT "notifications_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
CREATE TABLE "notification_types" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"channel_policy" "notification_channel" DEFAULT 'BOTH' NOT NULL,
	CONSTRAINT "notification_types_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "notification_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_system" boolean DEFAULT false NOT NULL,
	"status" "notification_template_status" DEFAULT 'DRAFT' NOT NULL,
	"type_fk" bigint NOT NULL,
	"language" varchar(5) DEFAULT 'en' NOT NULL,
	"title_template" varchar(255) NOT NULL,
	"body_template" text NOT NULL,
	CONSTRAINT "notification_templates_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"user_fk" bigint NOT NULL,
	"token" text NOT NULL,
	"device_id" varchar(255),
	"device_name" varchar(255),
	"device_type" "device_type",
	"last_used_at" timestamp with time zone,
	CONSTRAINT "push_tokens_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "push_tokens_user_device_idx" UNIQUE("user_fk","device_id")
);
--> statement-breakpoint
CREATE TABLE "entity_status_mapping" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"entity_code" varchar(50) NOT NULL,
	"status_fk" bigint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "entity_status_mapping_unique_idx" UNIQUE("entity_code","status_fk")
);
--> statement-breakpoint
CREATE TABLE "status" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" varchar(100),
	"font_color" varchar(7),
	"bg_color" varchar(7),
	"border_color" varchar(7),
	"is_bold" boolean DEFAULT false NOT NULL,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "status_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "status_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "entity" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"entity_name" varchar(100) NOT NULL,
	"description" text,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "entity_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "entity_entity_name_unique" UNIQUE("entity_name")
);
--> statement-breakpoint
CREATE TABLE "communication" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"entity_fk" bigint NOT NULL,
	"record_id" bigint NOT NULL,
	"communication_type_fk" bigint NOT NULL,
	"email" varchar(255),
	"fax" varchar(50),
	"phone_number" varchar(20),
	"dial_country_fk" bigint,
	"website" varchar(255),
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "communication_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "communication_active_deleted_consistent_chk" CHECK (NOT (is_active = true AND deleted_at IS NOT NULL)),
	CONSTRAINT "communication_at_least_one_value_chk" CHECK ((
    email IS NOT NULL OR
    fax IS NOT NULL OR
    phone_number IS NOT NULL OR
    website IS NOT NULL
  )),
	CONSTRAINT "communication_dial_country_requires_phone_chk" CHECK ((
    dial_country_fk IS NULL OR phone_number IS NOT NULL
  ))
);
--> statement-breakpoint
CREATE TABLE "contact_person" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"entity_fk" bigint NOT NULL,
	"record_id" bigint NOT NULL,
	"contact_person_type_fk" bigint NOT NULL,
	"salutation_fk" bigint,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100),
	"designation_fk" bigint,
	"designation_free_text" varchar(100),
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "contact_person_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"entity_fk" bigint NOT NULL,
	"record_id" bigint NOT NULL,
	"notes_type_fk" bigint NOT NULL,
	"content" text NOT NULL,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "notes_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
CREATE TABLE "staff_invite" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"store_fk" bigint NOT NULL,
	"invited_by_fk" bigint,
	"invitee_email" varchar(255) NOT NULL,
	"invitee_fk" bigint,
	"role_fk" bigint NOT NULL,
	"token" varchar(64) NOT NULL,
	"status_fk" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by_fk" bigint,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "staff_invite_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "staff_invite_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"code" varchar(60) NOT NULL,
	"name" varchar(60) NOT NULL,
	"description" text,
	"trial_days" integer,
	"is_enterprise" boolean DEFAULT false,
	"is_digital_service" boolean DEFAULT false,
	"is_more_popular" boolean DEFAULT false,
	"plan_type_fk" bigint NOT NULL,
	"allow_to_upgrade_fk" bigint,
	"allow_to_downgrade_fk" bigint,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "plans_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "plans_code_unique" UNIQUE("code"),
	CONSTRAINT "plans_no_self_upgrade_chk" CHECK (allow_to_upgrade_fk IS NULL OR allow_to_upgrade_fk != id),
	CONSTRAINT "plans_no_self_downgrade_chk" CHECK (allow_to_downgrade_fk IS NULL OR allow_to_downgrade_fk != id)
);
--> statement-breakpoint
CREATE TABLE "plan_price" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"billing_cycle" varchar(60),
	"interval_count" integer,
	"is_tax_inclusive" boolean DEFAULT false,
	"plan_fk" bigint NOT NULL,
	"currency_fk" bigint NOT NULL,
	"frequency_fk" bigint NOT NULL,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "plan_price_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"store_fk" bigint NOT NULL,
	"plan_fk" bigint NOT NULL,
	"status_fk" bigint NOT NULL,
	"first_invoice_recorded_at" date,
	"trial_end" date,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "subscription_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
CREATE TABLE "subscription_item" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"subscription_fk" bigint NOT NULL,
	"plan_price_fk" bigint,
	"price_mode" varchar(30) DEFAULT 'RECURRING' NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "subscription_item_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_fk" bigint,
	"store_fk" bigint,
	"session_fk" bigint,
	"phone_number" varchar(20),
	"action" "audit_action_type" NOT NULL,
	"entity_type" varchar(50),
	"entity_id" bigint,
	"old_values" jsonb,
	"new_values" jsonb,
	"meta" jsonb,
	"ip_address" "inet",
	"user_agent" text,
	"device_id" varchar(100),
	"device_type" "session_device_type",
	"is_success" boolean DEFAULT true NOT NULL,
	"failure_reason" text
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"user_fk" bigint NOT NULL,
	"theme" varchar(20) DEFAULT 'light',
	"timezone" varchar(50),
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "user_preferences_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "user_preferences_user_unique" UNIQUE("user_fk")
);
--> statement-breakpoint
CREATE TABLE "system_config" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"key" varchar(128) NOT NULL,
	"value" text NOT NULL,
	"description" varchar(500),
	"is_secret" boolean DEFAULT false NOT NULL,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "system_config_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "system_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "files_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"entity_type" varchar(50) NOT NULL,
	"entity_id" bigint NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_key" varchar(500) NOT NULL,
	"file_size" bigint NOT NULL,
	"mime_type" varchar(100),
	"file_url" varchar(500),
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" bigint NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" bigint
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_blocked_by_users_id_fk" FOREIGN KEY ("blocked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_session" ADD CONSTRAINT "user_session_user_fk_users_id_fk" FOREIGN KEY ("user_fk") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_session" ADD CONSTRAINT "user_session_active_store_fk_store_id_fk" FOREIGN KEY ("active_store_fk") REFERENCES "public"."store"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_auth_provider" ADD CONSTRAINT "user_auth_provider_user_fk_users_id_fk" FOREIGN KEY ("user_fk") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_verification" ADD CONSTRAINT "otp_verification_auth_provider_fk_user_auth_provider_id_fk" FOREIGN KEY ("auth_provider_fk") REFERENCES "public"."user_auth_provider"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_mapping" ADD CONSTRAINT "user_role_mapping_user_fk_users_id_fk" FOREIGN KEY ("user_fk") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_mapping" ADD CONSTRAINT "user_role_mapping_role_fk_roles_id_fk" FOREIGN KEY ("role_fk") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_mapping" ADD CONSTRAINT "user_role_mapping_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_mapping" ADD CONSTRAINT "user_role_mapping_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_owner_user_fk_users_id_fk" FOREIGN KEY ("owner_user_fk") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_store_legal_type_fk_store_legal_type_id_fk" FOREIGN KEY ("store_legal_type_fk") REFERENCES "public"."store_legal_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_store_category_fk_store_category_id_fk" FOREIGN KEY ("store_category_fk") REFERENCES "public"."store_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_country_fk_country_id_fk" FOREIGN KEY ("country_fk") REFERENCES "public"."country"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_parent_store_fk_store_id_fk" FOREIGN KEY ("parent_store_fk") REFERENCES "public"."store"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_user_mapping" ADD CONSTRAINT "store_user_mapping_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_user_mapping" ADD CONSTRAINT "store_user_mapping_user_fk_users_id_fk" FOREIGN KEY ("user_fk") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_user_mapping" ADD CONSTRAINT "store_user_mapping_designation_fk_code_value_id_fk" FOREIGN KEY ("designation_fk") REFERENCES "public"."code_value"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_user_mapping" ADD CONSTRAINT "store_user_mapping_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_user_mapping" ADD CONSTRAINT "store_user_mapping_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_user_mapping" ADD CONSTRAINT "store_user_mapping_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_documents" ADD CONSTRAINT "store_documents_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_documents" ADD CONSTRAINT "store_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_documents" ADD CONSTRAINT "store_documents_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_documents" ADD CONSTRAINT "store_documents_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_operating_hours" ADD CONSTRAINT "store_operating_hours_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_operating_hours" ADD CONSTRAINT "store_operating_hours_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_operating_hours" ADD CONSTRAINT "store_operating_hours_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_operating_hours" ADD CONSTRAINT "store_operating_hours_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_parent_route_fk_routes_id_fk" FOREIGN KEY ("parent_route_fk") REFERENCES "public"."routes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_route_mapping" ADD CONSTRAINT "role_route_mapping_role_fk_roles_id_fk" FOREIGN KEY ("role_fk") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_route_mapping" ADD CONSTRAINT "role_route_mapping_route_fk_routes_id_fk" FOREIGN KEY ("route_fk") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_route_mapping" ADD CONSTRAINT "role_route_mapping_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_entity_permission" ADD CONSTRAINT "role_entity_permission_role_fk_roles_id_fk" FOREIGN KEY ("role_fk") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_entity_permission" ADD CONSTRAINT "role_entity_permission_entity_type_fk_entity_type_id_fk" FOREIGN KEY ("entity_type_fk") REFERENCES "public"."entity_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "country" ADD CONSTRAINT "country_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "country" ADD CONSTRAINT "country_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "country" ADD CONSTRAINT "country_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state" ADD CONSTRAINT "state_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state" ADD CONSTRAINT "state_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state" ADD CONSTRAINT "state_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "district" ADD CONSTRAINT "district_state_fk_state_id_fk" FOREIGN KEY ("state_fk") REFERENCES "public"."state"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "district" ADD CONSTRAINT "district_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "district" ADD CONSTRAINT "district_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "district" ADD CONSTRAINT "district_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pincode" ADD CONSTRAINT "pincode_district_fk_district_id_fk" FOREIGN KEY ("district_fk") REFERENCES "public"."district"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pincode" ADD CONSTRAINT "pincode_state_fk_state_id_fk" FOREIGN KEY ("state_fk") REFERENCES "public"."state"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pincode" ADD CONSTRAINT "pincode_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pincode" ADD CONSTRAINT "pincode_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pincode" ADD CONSTRAINT "pincode_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_entity_fk_entity_id_fk" FOREIGN KEY ("entity_fk") REFERENCES "public"."entity"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_address_type_fk_address_type_id_fk" FOREIGN KEY ("address_type_fk") REFERENCES "public"."address_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_state_fk_state_id_fk" FOREIGN KEY ("state_fk") REFERENCES "public"."state"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_district_fk_district_id_fk" FOREIGN KEY ("district_fk") REFERENCES "public"."district"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_pincode_fk_pincode_id_fk" FOREIGN KEY ("pincode_fk") REFERENCES "public"."pincode"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address_type" ADD CONSTRAINT "address_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address_type" ADD CONSTRAINT "address_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address_type" ADD CONSTRAINT "address_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commodity_codes" ADD CONSTRAINT "commodity_codes_country_fk_country_id_fk" FOREIGN KEY ("country_fk") REFERENCES "public"."country"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commodity_codes" ADD CONSTRAINT "commodity_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commodity_codes" ADD CONSTRAINT "commodity_codes_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commodity_codes" ADD CONSTRAINT "commodity_codes_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_agencies" ADD CONSTRAINT "tax_agencies_country_fk_country_id_fk" FOREIGN KEY ("country_fk") REFERENCES "public"."country"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_agencies" ADD CONSTRAINT "tax_agencies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_agencies" ADD CONSTRAINT "tax_agencies_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_agencies" ADD CONSTRAINT "tax_agencies_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_names" ADD CONSTRAINT "tax_names_tax_agency_fk_tax_agencies_id_fk" FOREIGN KEY ("tax_agency_fk") REFERENCES "public"."tax_agencies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_names" ADD CONSTRAINT "tax_names_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_names" ADD CONSTRAINT "tax_names_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_names" ADD CONSTRAINT "tax_names_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_levels" ADD CONSTRAINT "tax_levels_tax_name_fk_tax_names_id_fk" FOREIGN KEY ("tax_name_fk") REFERENCES "public"."tax_names"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_levels" ADD CONSTRAINT "tax_levels_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_levels" ADD CONSTRAINT "tax_levels_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_levels" ADD CONSTRAINT "tax_levels_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_level_mapping" ADD CONSTRAINT "tax_level_mapping_tax_agency_fk_tax_agencies_id_fk" FOREIGN KEY ("tax_agency_fk") REFERENCES "public"."tax_agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_level_mapping" ADD CONSTRAINT "tax_level_mapping_tax_name_fk_tax_names_id_fk" FOREIGN KEY ("tax_name_fk") REFERENCES "public"."tax_names"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_level_mapping" ADD CONSTRAINT "tax_level_mapping_tax_level_fk_tax_levels_id_fk" FOREIGN KEY ("tax_level_fk") REFERENCES "public"."tax_levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_registrations" ADD CONSTRAINT "tax_registrations_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_registrations" ADD CONSTRAINT "tax_registrations_country_fk_country_id_fk" FOREIGN KEY ("country_fk") REFERENCES "public"."country"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_registrations" ADD CONSTRAINT "tax_registrations_tax_agency_fk_tax_agencies_id_fk" FOREIGN KEY ("tax_agency_fk") REFERENCES "public"."tax_agencies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_registrations" ADD CONSTRAINT "tax_registrations_tax_name_fk_tax_names_id_fk" FOREIGN KEY ("tax_name_fk") REFERENCES "public"."tax_names"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_registrations" ADD CONSTRAINT "tax_registrations_registration_type_fk_tax_registration_type_id_fk" FOREIGN KEY ("registration_type_fk") REFERENCES "public"."tax_registration_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_registrations" ADD CONSTRAINT "tax_registrations_filing_frequency_fk_tax_filing_frequency_id_fk" FOREIGN KEY ("filing_frequency_fk") REFERENCES "public"."tax_filing_frequency"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_registrations" ADD CONSTRAINT "tax_registrations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_registrations" ADD CONSTRAINT "tax_registrations_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_registrations" ADD CONSTRAINT "tax_registrations_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_registration_type" ADD CONSTRAINT "tax_registration_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_registration_type" ADD CONSTRAINT "tax_registration_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_registration_type" ADD CONSTRAINT "tax_registration_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_filing_frequency" ADD CONSTRAINT "tax_filing_frequency_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_filing_frequency" ADD CONSTRAINT "tax_filing_frequency_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_filing_frequency" ADD CONSTRAINT "tax_filing_frequency_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_line_status" ADD CONSTRAINT "tax_line_status_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_line_status" ADD CONSTRAINT "tax_line_status_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_line_status" ADD CONSTRAINT "tax_line_status_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD CONSTRAINT "tax_rate_master_country_fk_country_id_fk" FOREIGN KEY ("country_fk") REFERENCES "public"."country"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD CONSTRAINT "tax_rate_master_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD CONSTRAINT "tax_rate_master_commodity_code_fk_commodity_codes_id_fk" FOREIGN KEY ("commodity_code_fk") REFERENCES "public"."commodity_codes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD CONSTRAINT "tax_rate_master_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD CONSTRAINT "tax_rate_master_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD CONSTRAINT "tax_rate_master_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tax_summary" ADD CONSTRAINT "daily_tax_summary_country_fk_country_id_fk" FOREIGN KEY ("country_fk") REFERENCES "public"."country"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tax_summary" ADD CONSTRAINT "daily_tax_summary_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tax_summary" ADD CONSTRAINT "daily_tax_summary_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tax_summary" ADD CONSTRAINT "daily_tax_summary_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tax_summary" ADD CONSTRAINT "daily_tax_summary_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD CONSTRAINT "transaction_tax_lines_country_fk_country_id_fk" FOREIGN KEY ("country_fk") REFERENCES "public"."country"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD CONSTRAINT "transaction_tax_lines_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD CONSTRAINT "transaction_tax_lines_tax_registration_fk_tax_registrations_id_fk" FOREIGN KEY ("tax_registration_fk") REFERENCES "public"."tax_registrations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD CONSTRAINT "transaction_tax_lines_commodity_code_fk_commodity_codes_id_fk" FOREIGN KEY ("commodity_code_fk") REFERENCES "public"."commodity_codes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD CONSTRAINT "transaction_tax_lines_tax_rate_master_fk_tax_rate_master_id_fk" FOREIGN KEY ("tax_rate_master_fk") REFERENCES "public"."tax_rate_master"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD CONSTRAINT "transaction_tax_lines_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD CONSTRAINT "transaction_tax_lines_approval_status_fk_tax_line_status_id_fk" FOREIGN KEY ("approval_status_fk") REFERENCES "public"."tax_line_status"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD CONSTRAINT "transaction_tax_lines_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_category" ADD CONSTRAINT "code_category_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_category" ADD CONSTRAINT "code_category_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_category" ADD CONSTRAINT "code_category_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_value" ADD CONSTRAINT "code_value_category_fk_code_category_id_fk" FOREIGN KEY ("category_fk") REFERENCES "public"."code_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_value" ADD CONSTRAINT "code_value_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_value" ADD CONSTRAINT "code_value_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_value" ADD CONSTRAINT "code_value_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_value" ADD CONSTRAINT "code_value_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lookup" ADD CONSTRAINT "lookup_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lookup" ADD CONSTRAINT "lookup_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lookup" ADD CONSTRAINT "lookup_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salutation_type" ADD CONSTRAINT "salutation_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salutation_type" ADD CONSTRAINT "salutation_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salutation_type" ADD CONSTRAINT "salutation_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designation_type" ADD CONSTRAINT "designation_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designation_type" ADD CONSTRAINT "designation_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designation_type" ADD CONSTRAINT "designation_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_legal_type" ADD CONSTRAINT "store_legal_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_legal_type" ADD CONSTRAINT "store_legal_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_legal_type" ADD CONSTRAINT "store_legal_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_category" ADD CONSTRAINT "store_category_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_category" ADD CONSTRAINT "store_category_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_category" ADD CONSTRAINT "store_category_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_type" ADD CONSTRAINT "communication_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_type" ADD CONSTRAINT "communication_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_type" ADD CONSTRAINT "communication_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person_type" ADD CONSTRAINT "contact_person_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person_type" ADD CONSTRAINT "contact_person_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person_type" ADD CONSTRAINT "contact_person_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes_type" ADD CONSTRAINT "notes_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes_type" ADD CONSTRAINT "notes_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes_type" ADD CONSTRAINT "notes_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volumes" ADD CONSTRAINT "volumes_base_volume_fk_volumes_id_fk" FOREIGN KEY ("base_volume_fk") REFERENCES "public"."volumes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volumes" ADD CONSTRAINT "volumes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volumes" ADD CONSTRAINT "volumes_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volumes" ADD CONSTRAINT "volumes_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "currency" ADD CONSTRAINT "currency_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "currency" ADD CONSTRAINT "currency_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "currency" ADD CONSTRAINT "currency_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_frequency" ADD CONSTRAINT "billing_frequency_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_frequency" ADD CONSTRAINT "billing_frequency_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_frequency" ADD CONSTRAINT "billing_frequency_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_type" ADD CONSTRAINT "plan_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_type" ADD CONSTRAINT "plan_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_type" ADD CONSTRAINT "plan_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_type" ADD CONSTRAINT "entity_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_type" ADD CONSTRAINT "entity_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_type" ADD CONSTRAINT "entity_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_status" ADD CONSTRAINT "notification_status_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_status" ADD CONSTRAINT "notification_status_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_status" ADD CONSTRAINT "notification_status_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite_status" ADD CONSTRAINT "staff_invite_status_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite_status" ADD CONSTRAINT "staff_invite_status_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite_status" ADD CONSTRAINT "staff_invite_status_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_fk_users_id_fk" FOREIGN KEY ("user_fk") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_fk_notification_types_id_fk" FOREIGN KEY ("type_fk") REFERENCES "public"."notification_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_template_fk_notification_templates_id_fk" FOREIGN KEY ("template_fk") REFERENCES "public"."notification_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_status_fk_notification_status_id_fk" FOREIGN KEY ("status_fk") REFERENCES "public"."notification_status"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_type_fk_notification_types_id_fk" FOREIGN KEY ("type_fk") REFERENCES "public"."notification_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_fk_users_id_fk" FOREIGN KEY ("user_fk") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_status_mapping" ADD CONSTRAINT "entity_status_mapping_status_fk_status_id_fk" FOREIGN KEY ("status_fk") REFERENCES "public"."status"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status" ADD CONSTRAINT "status_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status" ADD CONSTRAINT "status_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status" ADD CONSTRAINT "status_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity" ADD CONSTRAINT "entity_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity" ADD CONSTRAINT "entity_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity" ADD CONSTRAINT "entity_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication" ADD CONSTRAINT "communication_entity_fk_entity_id_fk" FOREIGN KEY ("entity_fk") REFERENCES "public"."entity"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication" ADD CONSTRAINT "communication_communication_type_fk_communication_type_id_fk" FOREIGN KEY ("communication_type_fk") REFERENCES "public"."communication_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication" ADD CONSTRAINT "communication_dial_country_fk_country_id_fk" FOREIGN KEY ("dial_country_fk") REFERENCES "public"."country"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication" ADD CONSTRAINT "communication_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication" ADD CONSTRAINT "communication_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication" ADD CONSTRAINT "communication_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person" ADD CONSTRAINT "contact_person_entity_fk_entity_id_fk" FOREIGN KEY ("entity_fk") REFERENCES "public"."entity"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person" ADD CONSTRAINT "contact_person_contact_person_type_fk_contact_person_type_id_fk" FOREIGN KEY ("contact_person_type_fk") REFERENCES "public"."contact_person_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person" ADD CONSTRAINT "contact_person_salutation_fk_salutation_type_id_fk" FOREIGN KEY ("salutation_fk") REFERENCES "public"."salutation_type"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person" ADD CONSTRAINT "contact_person_designation_fk_designation_type_id_fk" FOREIGN KEY ("designation_fk") REFERENCES "public"."designation_type"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person" ADD CONSTRAINT "contact_person_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person" ADD CONSTRAINT "contact_person_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person" ADD CONSTRAINT "contact_person_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_entity_fk_entity_id_fk" FOREIGN KEY ("entity_fk") REFERENCES "public"."entity"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_notes_type_fk_notes_type_id_fk" FOREIGN KEY ("notes_type_fk") REFERENCES "public"."notes_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite" ADD CONSTRAINT "staff_invite_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite" ADD CONSTRAINT "staff_invite_invited_by_fk_users_id_fk" FOREIGN KEY ("invited_by_fk") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite" ADD CONSTRAINT "staff_invite_invitee_fk_users_id_fk" FOREIGN KEY ("invitee_fk") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite" ADD CONSTRAINT "staff_invite_role_fk_roles_id_fk" FOREIGN KEY ("role_fk") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite" ADD CONSTRAINT "staff_invite_status_fk_staff_invite_status_id_fk" FOREIGN KEY ("status_fk") REFERENCES "public"."staff_invite_status"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite" ADD CONSTRAINT "staff_invite_accepted_by_fk_users_id_fk" FOREIGN KEY ("accepted_by_fk") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite" ADD CONSTRAINT "staff_invite_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite" ADD CONSTRAINT "staff_invite_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite" ADD CONSTRAINT "staff_invite_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_plan_type_fk_plan_type_id_fk" FOREIGN KEY ("plan_type_fk") REFERENCES "public"."plan_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_allow_to_upgrade_fk_plans_id_fk" FOREIGN KEY ("allow_to_upgrade_fk") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_allow_to_downgrade_fk_plans_id_fk" FOREIGN KEY ("allow_to_downgrade_fk") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_price" ADD CONSTRAINT "plan_price_plan_fk_plans_id_fk" FOREIGN KEY ("plan_fk") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_price" ADD CONSTRAINT "plan_price_currency_fk_currency_id_fk" FOREIGN KEY ("currency_fk") REFERENCES "public"."currency"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_price" ADD CONSTRAINT "plan_price_frequency_fk_billing_frequency_id_fk" FOREIGN KEY ("frequency_fk") REFERENCES "public"."billing_frequency"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_price" ADD CONSTRAINT "plan_price_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_price" ADD CONSTRAINT "plan_price_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_price" ADD CONSTRAINT "plan_price_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_plan_fk_plans_id_fk" FOREIGN KEY ("plan_fk") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_status_fk_status_id_fk" FOREIGN KEY ("status_fk") REFERENCES "public"."status"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_item" ADD CONSTRAINT "subscription_item_subscription_fk_subscription_id_fk" FOREIGN KEY ("subscription_fk") REFERENCES "public"."subscription"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_item" ADD CONSTRAINT "subscription_item_plan_price_fk_plan_price_id_fk" FOREIGN KEY ("plan_price_fk") REFERENCES "public"."plan_price"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_item" ADD CONSTRAINT "subscription_item_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_item" ADD CONSTRAINT "subscription_item_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_item" ADD CONSTRAINT "subscription_item_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_fk_users_id_fk" FOREIGN KEY ("user_fk") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_session_fk_user_session_id_fk" FOREIGN KEY ("session_fk") REFERENCES "public"."user_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_fk_users_id_fk" FOREIGN KEY ("user_fk") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_config" ADD CONSTRAINT "system_config_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_config" ADD CONSTRAINT "system_config_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_config" ADD CONSTRAINT "system_config_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_phone_number_idx" ON "users" USING btree ("phone_number");--> statement-breakpoint
CREATE UNIQUE INDEX "users_iam_user_id_idx" ON "users" USING btree ("iam_user_id");--> statement-breakpoint
CREATE INDEX "users_blocked_by_idx" ON "users" USING btree ("blocked_by");--> statement-breakpoint
CREATE INDEX "users_profile_completed_idx" ON "users" USING btree ("profile_completed");--> statement-breakpoint
CREATE INDEX "users_permissions_version_idx" ON "users" USING btree ("permissions_version");--> statement-breakpoint
CREATE INDEX "user_session_user_idx" ON "user_session" USING btree ("user_fk");--> statement-breakpoint
CREATE INDEX "user_session_token_idx" ON "user_session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "user_session_revoked_idx" ON "user_session" USING btree ("user_fk","refresh_token_revoked_at");--> statement-breakpoint
CREATE INDEX "user_auth_provider_user_idx" ON "user_auth_provider" USING btree ("user_fk");--> statement-breakpoint
CREATE UNIQUE INDEX "user_auth_provider_user_provider_unique" ON "user_auth_provider" USING btree ("user_fk","provider_id");--> statement-breakpoint
CREATE INDEX "otp_verification_identifier_purpose_idx" ON "otp_verification" USING btree ("identifier","purpose");--> statement-breakpoint
CREATE INDEX "otp_verification_auth_provider_idx" ON "otp_verification" USING btree ("auth_provider_fk");--> statement-breakpoint
CREATE INDEX "otp_request_log_identifier_hash_idx" ON "otp_request_log" USING btree ("identifier_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "urm_unique_global_idx" ON "user_role_mapping" USING btree ("user_fk","role_fk") WHERE store_fk IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "urm_unique_store_idx" ON "user_role_mapping" USING btree ("user_fk","role_fk","store_fk") WHERE store_fk IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "urm_primary_global_idx" ON "user_role_mapping" USING btree ("user_fk") WHERE store_fk IS NULL AND is_primary = true AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "urm_primary_store_idx" ON "user_role_mapping" USING btree ("user_fk","store_fk") WHERE store_fk IS NOT NULL AND is_primary = true AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "urm_user_idx" ON "user_role_mapping" USING btree ("user_fk");--> statement-breakpoint
CREATE INDEX "urm_role_idx" ON "user_role_mapping" USING btree ("role_fk");--> statement-breakpoint
CREATE INDEX "urm_store_idx" ON "user_role_mapping" USING btree ("store_fk");--> statement-breakpoint
CREATE INDEX "urm_user_store_idx" ON "user_role_mapping" USING btree ("user_fk","store_fk");--> statement-breakpoint
CREATE INDEX "store_owner_user_idx" ON "store" USING btree ("owner_user_fk");--> statement-breakpoint
CREATE UNIQUE INDEX "store_user_mapping_active_unique_idx" ON "store_user_mapping" USING btree ("store_fk","user_fk") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "store_user_mapping_user_idx" ON "store_user_mapping" USING btree ("user_fk");--> statement-breakpoint
CREATE INDEX "store_user_mapping_designation_idx" ON "store_user_mapping" USING btree ("designation_fk");--> statement-breakpoint
CREATE INDEX "store_user_mapping_assigned_by_idx" ON "store_user_mapping" USING btree ("assigned_by");--> statement-breakpoint
CREATE INDEX "store_documents_store_idx" ON "store_documents" USING btree ("store_fk");--> statement-breakpoint
CREATE INDEX "store_documents_type_idx" ON "store_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "store_documents_expiry_idx" ON "store_documents" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "store_operating_hours_store_idx" ON "store_operating_hours" USING btree ("store_fk");--> statement-breakpoint
CREATE INDEX "store_operating_hours_day_idx" ON "store_operating_hours" USING btree ("day_of_week");--> statement-breakpoint
CREATE INDEX "store_operating_hours_store_day_idx" ON "store_operating_hours" USING btree ("store_fk","day_of_week");--> statement-breakpoint
CREATE INDEX "store_operating_hours_closed_idx" ON "store_operating_hours" USING btree ("is_closed");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_code_store_idx" ON "roles" USING btree ("code","store_fk") WHERE deleted_at IS NULL AND store_fk IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_store_idx" ON "roles" USING btree ("role_name","store_fk") WHERE deleted_at IS NULL AND store_fk IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_code_global_idx" ON "roles" USING btree ("code") WHERE deleted_at IS NULL AND store_fk IS NULL;--> statement-breakpoint
CREATE INDEX "roles_store_idx" ON "roles" USING btree ("store_fk");--> statement-breakpoint
CREATE INDEX "roles_is_system_idx" ON "roles" USING btree ("is_system");--> statement-breakpoint
CREATE UNIQUE INDEX "routes_path_scope_idx" ON "routes" USING btree ("route_path","route_scope") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "role_route_mapping_route_idx" ON "role_route_mapping" USING btree ("route_fk");--> statement-breakpoint
CREATE INDEX "role_entity_permission_role_entity_idx" ON "role_entity_permission" USING btree ("role_fk","entity_type_fk");--> statement-breakpoint
CREATE INDEX "role_entity_permission_role_idx" ON "role_entity_permission" USING btree ("role_fk");--> statement-breakpoint
CREATE INDEX "role_entity_permission_entity_idx" ON "role_entity_permission" USING btree ("entity_type_fk");--> statement-breakpoint
CREATE INDEX "role_entity_permission_active_idx" ON "role_entity_permission" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "state_name_idx" ON "state" USING btree ("state_name") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "state_code_idx" ON "state" USING btree ("state_code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "district_name_state_idx" ON "district" USING btree ("district_name","state_fk") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "district_state_idx" ON "district" USING btree ("state_fk");--> statement-breakpoint
CREATE UNIQUE INDEX "pincode_code_idx" ON "pincode" USING btree ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "pincode_district_idx" ON "pincode" USING btree ("district_fk");--> statement-breakpoint
CREATE INDEX "pincode_state_idx" ON "pincode" USING btree ("state_fk");--> statement-breakpoint
CREATE INDEX "address_entity_record_idx" ON "address" USING btree ("entity_fk","record_id");--> statement-breakpoint
CREATE INDEX "address_entity_type_idx" ON "address" USING btree ("entity_fk","address_type_fk");--> statement-breakpoint
CREATE INDEX "address_entity_record_active_idx" ON "address" USING btree ("entity_fk","record_id") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "address_entity_idx" ON "address" USING btree ("entity_fk");--> statement-breakpoint
CREATE INDEX "address_record_idx" ON "address" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "address_type_idx" ON "address" USING btree ("address_type_fk");--> statement-breakpoint
CREATE INDEX "address_state_idx" ON "address" USING btree ("state_fk");--> statement-breakpoint
CREATE INDEX "address_district_idx" ON "address" USING btree ("district_fk");--> statement-breakpoint
CREATE INDEX "address_pincode_idx" ON "address" USING btree ("pincode_fk");--> statement-breakpoint
CREATE UNIQUE INDEX "address_one_default_idx" ON "address" USING btree ("entity_fk","record_id") WHERE is_default_address = true AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "address_one_billing_idx" ON "address" USING btree ("entity_fk","record_id") WHERE is_billing_address = true AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "commodity_codes_code_country_type_unique" ON "commodity_codes" USING btree ("code","country_fk","type");--> statement-breakpoint
CREATE INDEX "commodity_codes_type_code_idx" ON "commodity_codes" USING btree ("type","code");--> statement-breakpoint
CREATE INDEX "commodity_codes_digits_idx" ON "commodity_codes" USING btree ("digits");--> statement-breakpoint
CREATE INDEX "commodity_codes_country_idx" ON "commodity_codes" USING btree ("country_fk");--> statement-breakpoint
CREATE INDEX "commodity_codes_country_type_idx" ON "commodity_codes" USING btree ("country_fk","type");--> statement-breakpoint
CREATE INDEX "tax_agencies_code_idx" ON "tax_agencies" USING btree ("code");--> statement-breakpoint
CREATE INDEX "tax_agencies_country_idx" ON "tax_agencies" USING btree ("country_fk");--> statement-breakpoint
CREATE INDEX "tax_names_code_idx" ON "tax_names" USING btree ("code");--> statement-breakpoint
CREATE INDEX "tax_names_agency_idx" ON "tax_names" USING btree ("tax_agency_fk");--> statement-breakpoint
CREATE INDEX "tax_levels_code_idx" ON "tax_levels" USING btree ("code");--> statement-breakpoint
CREATE INDEX "tax_levels_tax_name_idx" ON "tax_levels" USING btree ("tax_name_fk");--> statement-breakpoint
CREATE INDEX "tax_levels_rate_idx" ON "tax_levels" USING btree ("rate");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_level_mapping_unique_idx" ON "tax_level_mapping" USING btree ("tax_agency_fk","tax_name_fk","tax_level_fk");--> statement-breakpoint
CREATE INDEX "tax_level_mapping_agency_name_idx" ON "tax_level_mapping" USING btree ("tax_agency_fk","tax_name_fk");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_registrations_active_idx" ON "tax_registrations" USING btree ("store_fk","tax_agency_fk","tax_name_fk") WHERE deleted_at IS NULL AND effective_to IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tax_registrations_number_country_idx" ON "tax_registrations" USING btree ("registration_number","country_fk");--> statement-breakpoint
CREATE INDEX "tax_registrations_store_idx" ON "tax_registrations" USING btree ("store_fk");--> statement-breakpoint
CREATE INDEX "tax_registrations_agency_idx" ON "tax_registrations" USING btree ("tax_agency_fk");--> statement-breakpoint
CREATE INDEX "tax_registrations_number_idx" ON "tax_registrations" USING btree ("registration_number");--> statement-breakpoint
CREATE INDEX "tax_registrations_country_idx" ON "tax_registrations" USING btree ("country_fk");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_rate_master_active_idx" ON "tax_rate_master" USING btree ("country_fk","store_fk","commodity_code_fk") WHERE is_active = true AND deleted_at IS NULL AND effective_to IS NULL;--> statement-breakpoint
CREATE INDEX "tax_rate_master_country_idx" ON "tax_rate_master" USING btree ("country_fk");--> statement-breakpoint
CREATE INDEX "tax_rate_master_store_idx" ON "tax_rate_master" USING btree ("store_fk");--> statement-breakpoint
CREATE INDEX "tax_rate_master_commodity_idx" ON "tax_rate_master" USING btree ("commodity_code_fk");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_tax_summary_store_date_rate_unique" ON "daily_tax_summary" USING btree ("country_fk","store_fk","transaction_date","tax_rate");--> statement-breakpoint
CREATE INDEX "daily_tax_summary_country_idx" ON "daily_tax_summary" USING btree ("country_fk");--> statement-breakpoint
CREATE INDEX "daily_tax_summary_store_date_idx" ON "daily_tax_summary" USING btree ("store_fk","transaction_date");--> statement-breakpoint
CREATE INDEX "daily_tax_summary_date_idx" ON "daily_tax_summary" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "daily_tax_summary_rate_idx" ON "daily_tax_summary" USING btree ("tax_rate");--> statement-breakpoint
CREATE INDEX "transaction_tax_lines_country_idx" ON "transaction_tax_lines" USING btree ("country_fk");--> statement-breakpoint
CREATE INDEX "transaction_tax_lines_store_date_idx" ON "transaction_tax_lines" USING btree ("store_fk","transaction_date");--> statement-breakpoint
CREATE INDEX "transaction_tax_lines_transaction_ref_idx" ON "transaction_tax_lines" USING btree ("transaction_ref");--> statement-breakpoint
CREATE INDEX "transaction_tax_lines_commodity_idx" ON "transaction_tax_lines" USING btree ("commodity_code_fk");--> statement-breakpoint
CREATE INDEX "transaction_tax_lines_registration_idx" ON "transaction_tax_lines" USING btree ("tax_registration_fk");--> statement-breakpoint
CREATE INDEX "transaction_tax_lines_country_store_commodity_date_idx" ON "transaction_tax_lines" USING btree ("country_fk","store_fk","commodity_code_fk","transaction_date");--> statement-breakpoint
CREATE INDEX "transaction_tax_lines_country_store_rate_date_idx" ON "transaction_tax_lines" USING btree ("country_fk","store_fk","applied_tax_rate","transaction_date");--> statement-breakpoint
CREATE UNIQUE INDEX "code_category_code_idx" ON "code_category" USING btree ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "code_value_code_category_global_idx" ON "code_value" USING btree ("code","category_fk") WHERE deleted_at IS NULL AND store_fk IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "code_value_code_category_store_idx" ON "code_value" USING btree ("code","category_fk","store_fk") WHERE deleted_at IS NULL AND store_fk IS NOT NULL;--> statement-breakpoint
CREATE INDEX "code_value_category_idx" ON "code_value" USING btree ("category_fk");--> statement-breakpoint
CREATE INDEX "code_value_store_idx" ON "code_value" USING btree ("store_fk");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_fk_idx" ON "notifications" USING btree ("user_fk");--> statement-breakpoint
CREATE INDEX "notifications_user_status_idx" ON "notifications" USING btree ("user_fk","status_fk");--> statement-breakpoint
CREATE INDEX "notifications_user_store_idx" ON "notifications" USING btree ("user_fk","store_fk");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_fk") WHERE read_at IS NULL;--> statement-breakpoint
CREATE INDEX "notifications_retry_idx" ON "notifications" USING btree ("status_fk","retry_count") WHERE retry_count < 3;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_ticket_idx" ON "notifications" USING btree ("expo_push_ticket_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_templates_published_idx" ON "notification_templates" USING btree ("type_fk","language") WHERE status = 'PUBLISHED' AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_templates_draft_idx" ON "notification_templates" USING btree ("type_fk","language") WHERE status = 'DRAFT' AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "push_tokens_user_fk_idx" ON "push_tokens" USING btree ("user_fk");--> statement-breakpoint
CREATE UNIQUE INDEX "push_tokens_token_idx" ON "push_tokens" USING btree ("token") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "entity_status_mapping_entity_idx" ON "entity_status_mapping" USING btree ("entity_code");--> statement-breakpoint
CREATE INDEX "entity_status_mapping_status_idx" ON "entity_status_mapping" USING btree ("status_fk");--> statement-breakpoint
CREATE INDEX "communication_entity_record_idx" ON "communication" USING btree ("entity_fk","record_id");--> statement-breakpoint
CREATE INDEX "communication_entity_record_active_idx" ON "communication" USING btree ("entity_fk","record_id") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "communication_entity_idx" ON "communication" USING btree ("entity_fk");--> statement-breakpoint
CREATE INDEX "communication_record_idx" ON "communication" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "communication_type_idx" ON "communication" USING btree ("communication_type_fk");--> statement-breakpoint
CREATE INDEX "communication_dial_country_idx" ON "communication" USING btree ("dial_country_fk");--> statement-breakpoint
CREATE INDEX "contact_person_entity_record_idx" ON "contact_person" USING btree ("entity_fk","record_id");--> statement-breakpoint
CREATE INDEX "contact_person_entity_record_active_idx" ON "contact_person" USING btree ("entity_fk","record_id") WHERE is_active = true;--> statement-breakpoint
CREATE UNIQUE INDEX "contact_person_one_primary_idx" ON "contact_person" USING btree ("entity_fk","record_id") WHERE is_primary = true AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "notes_entity_record_idx" ON "notes" USING btree ("entity_fk","record_id");--> statement-breakpoint
CREATE INDEX "notes_entity_record_active_idx" ON "notes" USING btree ("entity_fk","record_id") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "notes_entity_idx" ON "notes" USING btree ("entity_fk");--> statement-breakpoint
CREATE INDEX "notes_record_idx" ON "notes" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "notes_type_idx" ON "notes" USING btree ("notes_type_fk");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_invite_pending_unique_idx" ON "staff_invite" USING btree ("store_fk","invitee_email") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "plans_plan_type_idx" ON "plans" USING btree ("plan_type_fk");--> statement-breakpoint
CREATE INDEX "subscription_item_subscription_idx" ON "subscription_item" USING btree ("subscription_fk");--> statement-breakpoint
CREATE INDEX "subscription_item_plan_price_idx" ON "subscription_item" USING btree ("plan_price_fk");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_fk");--> statement-breakpoint
CREATE INDEX "audit_logs_store_idx" ON "audit_logs" USING btree ("store_fk");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_store_action_idx" ON "audit_logs" USING btree ("store_fk","action");--> statement-breakpoint
CREATE INDEX "files_entity_idx" ON "files" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "files_created_idx" ON "files" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "files_created_by_idx" ON "files" USING btree ("created_by");