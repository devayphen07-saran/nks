CREATE TYPE "public"."audit_action_type" AS ENUM('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'TOKEN_REFRESH', 'TOKEN_REVOKE', 'PASSWORD_RESET', 'EMAIL_VERIFIED', 'PHONE_VERIFIED', 'OTP_REQUESTED', 'OTP_VERIFIED', 'OTP_FAILED', 'INVITE_SENT', 'INVITE_ACCEPTED', 'INVITE_REVOKED', 'ROLE_ASSIGNED', 'ROLE_REVOKED', 'PERMISSION_GRANTED', 'PERMISSION_REVOKED', 'STORE_CREATED', 'STORE_DELETED', 'ACCOUNT_BLOCKED', 'ACCOUNT_UNBLOCKED');--> statement-breakpoint
CREATE TYPE "public"."device_type" AS ENUM('IOS', 'ANDROID');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('WEBSOCKET', 'PUSH', 'BOTH');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ');--> statement-breakpoint
CREATE TYPE "public"."notification_template_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('LOGIN', 'PHONE_VERIFY', 'EMAIL_VERIFY', 'RESET_PASSWORD');--> statement-breakpoint
CREATE TYPE "public"."route_type" AS ENUM('sidebar', 'tab', 'screen', 'modal');--> statement-breakpoint
CREATE TYPE "public"."session_device_type" AS ENUM('IOS', 'ANDROID', 'WEB');--> statement-breakpoint
CREATE TYPE "public"."staff_invite_status" AS ENUM('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."store_status" AS ENUM('ACTIVE', 'SUSPENDED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."volume_type" AS ENUM('weight', 'volume', 'length', 'count', 'area');--> statement-breakpoint
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
	"blocked_by" bigint,
	"login_count" integer DEFAULT 0 NOT NULL,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"last_login_at" timestamp with time zone,
	"last_active_at" timestamp with time zone,
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
	"app_version" varchar(20),
	"active_store_fk" bigint,
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
	"access_token_expires_date" timestamp with time zone,
	"refresh_token_expires_date" timestamp with time zone,
	"scope" text,
	"password" text,
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
	CONSTRAINT "otp_verification_guuid_unique" UNIQUE("guuid")
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
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "roles_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"name" varchar(100) NOT NULL,
	"code" varchar(100) NOT NULL,
	"resource" varchar(50) NOT NULL,
	"action" varchar(20) NOT NULL,
	"description" text,
	CONSTRAINT "permissions_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "permissions_name_unique" UNIQUE("name"),
	CONSTRAINT "permissions_code_unique" UNIQUE("code")
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
	"app_code" varchar(50),
	"is_public" boolean DEFAULT false NOT NULL,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "routes_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
CREATE TABLE "user_role_mapping" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_fk" bigint NOT NULL,
	"role_fk" bigint NOT NULL,
	"store_fk" bigint,
	"assigned_by" bigint
);
--> statement-breakpoint
CREATE TABLE "role_permission_mapping" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role_fk" bigint NOT NULL,
	"permission_fk" bigint NOT NULL,
	"assigned_by" bigint,
	CONSTRAINT "role_permission_mapping_unique_idx" UNIQUE("role_fk","permission_fk")
);
--> statement-breakpoint
CREATE TABLE "role_route_mapping" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role_fk" bigint NOT NULL,
	"route_fk" bigint NOT NULL,
	"allow" boolean DEFAULT true NOT NULL,
	"can_view" boolean DEFAULT true NOT NULL,
	"can_create" boolean DEFAULT false NOT NULL,
	"can_edit" boolean DEFAULT false NOT NULL,
	"can_delete" boolean DEFAULT false NOT NULL,
	"can_export" boolean DEFAULT false NOT NULL,
	"assigned_by" bigint,
	CONSTRAINT "role_route_mapping_unique_idx" UNIQUE("role_fk","route_fk")
);
--> statement-breakpoint
CREATE TABLE "user_permission_mapping" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_fk" bigint NOT NULL,
	"permission_fk" bigint NOT NULL,
	"store_fk" bigint NOT NULL,
	"assigned_by" bigint,
	CONSTRAINT "user_permission_mapping_unique_idx" UNIQUE("user_fk","permission_fk","store_fk")
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
	"status" "staff_invite_status" DEFAULT 'PENDING' NOT NULL,
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
CREATE TABLE "staff_invite_permission" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"invite_fk" bigint NOT NULL,
	"permission_fk" bigint NOT NULL,
	CONSTRAINT "staff_invite_permission_unique_idx" UNIQUE("invite_fk","permission_fk")
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
	"status" "notification_status" DEFAULT 'PENDING' NOT NULL,
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
	"legal_type_name" varchar(50) NOT NULL,
	"legal_type_code" varchar(30) NOT NULL,
	"description" text,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "store_legal_type_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "store_legal_type_legal_type_name_unique" UNIQUE("legal_type_name"),
	CONSTRAINT "store_legal_type_legal_type_code_unique" UNIQUE("legal_type_code")
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
	"category_name" varchar(50) NOT NULL,
	"category_code" varchar(30) NOT NULL,
	"description" text,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "store_category_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "store_category_category_name_unique" UNIQUE("category_name"),
	CONSTRAINT "store_category_category_code_unique" UNIQUE("category_code")
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
	"store_name" varchar(255) NOT NULL,
	"store_code" varchar(50),
	"owner_fk" bigint NOT NULL,
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
	CONSTRAINT "store_store_code_unique" UNIQUE("store_code"),
	CONSTRAINT "store_status_active_sync_chk" CHECK ((store_status = 'ACTIVE') = is_active)
);
--> statement-breakpoint
CREATE TABLE "designation" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"designation_name" varchar(100) NOT NULL,
	"designation_code" varchar(50) NOT NULL,
	"store_fk" bigint,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "designation_guuid_unique" UNIQUE("guuid")
);
--> statement-breakpoint
CREATE TABLE "store_user_mapping" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"store_fk" bigint NOT NULL,
	"user_fk" bigint NOT NULL,
	"designation_fk" bigint,
	"is_primary" boolean DEFAULT false NOT NULL,
	"joined_date" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by" bigint,
	CONSTRAINT "store_user_mapping_unique_idx" UNIQUE("store_fk","user_fk")
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
CREATE TABLE "state_region_province" (
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
	"state_code" varchar(20),
	"description" varchar(255),
	"country_fk" bigint NOT NULL,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "state_region_province_guuid_unique" UNIQUE("guuid")
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
	"description" varchar(255),
	"state_region_province_fk" bigint NOT NULL,
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
	"postal_code" varchar(20) NOT NULL,
	"city_name" varchar(150) NOT NULL,
	"district_fk" bigint NOT NULL,
	"state_region_province_fk" bigint NOT NULL,
	"country_fk" bigint NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "pincode_guuid_unique" UNIQUE("guuid")
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
	"state_region_province_fk" bigint,
	"state_region_province_text" varchar(100),
	"district_fk" bigint,
	"district_text" varchar(100),
	"postal_code" varchar(20),
	"country_fk" bigint NOT NULL,
	"is_billing_address" boolean DEFAULT false NOT NULL,
	"is_default_address" boolean DEFAULT false NOT NULL,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "address_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "address_state_fk_or_text_chk" CHECK (state_region_province_fk IS NULL OR state_region_province_text IS NULL),
	CONSTRAINT "address_district_fk_or_text_chk" CHECK (district_fk IS NULL OR district_text IS NULL)
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
	"designation_text" varchar(100),
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
	"address_type_name" varchar(50) NOT NULL,
	"address_type_code" varchar(30) NOT NULL,
	"description" text,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "address_type_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "address_type_address_type_name_unique" UNIQUE("address_type_name"),
	CONSTRAINT "address_type_address_type_code_unique" UNIQUE("address_type_code")
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
	"communication_type_name" varchar(50) NOT NULL,
	"communication_type_code" varchar(30) NOT NULL,
	"description" text,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "communication_type_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "communication_type_communication_type_name_unique" UNIQUE("communication_type_name"),
	CONSTRAINT "communication_type_communication_type_code_unique" UNIQUE("communication_type_code")
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
	"contact_person_type_name" varchar(50) NOT NULL,
	"contact_person_type_code" varchar(30) NOT NULL,
	"description" varchar(200),
	"can_receive_alerts" boolean DEFAULT false NOT NULL,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "contact_person_type_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "contact_person_type_contact_person_type_name_unique" UNIQUE("contact_person_type_name"),
	CONSTRAINT "contact_person_type_contact_person_type_code_unique" UNIQUE("contact_person_type_code")
);
--> statement-breakpoint
CREATE TABLE "salutation" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"salutation_text" varchar(20) NOT NULL,
	"description" text,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "salutation_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "salutation_salutation_text_unique" UNIQUE("salutation_text")
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_blocked_by_users_id_fk" FOREIGN KEY ("blocked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_session" ADD CONSTRAINT "user_session_user_fk_users_id_fk" FOREIGN KEY ("user_fk") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_session" ADD CONSTRAINT "user_session_active_store_fk_store_id_fk" FOREIGN KEY ("active_store_fk") REFERENCES "public"."store"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_auth_provider" ADD CONSTRAINT "user_auth_provider_user_fk_users_id_fk" FOREIGN KEY ("user_fk") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_parent_route_fk_routes_id_fk" FOREIGN KEY ("parent_route_fk") REFERENCES "public"."routes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_mapping" ADD CONSTRAINT "user_role_mapping_user_fk_users_id_fk" FOREIGN KEY ("user_fk") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_mapping" ADD CONSTRAINT "user_role_mapping_role_fk_roles_id_fk" FOREIGN KEY ("role_fk") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_mapping" ADD CONSTRAINT "user_role_mapping_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_mapping" ADD CONSTRAINT "user_role_mapping_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission_mapping" ADD CONSTRAINT "role_permission_mapping_role_fk_roles_id_fk" FOREIGN KEY ("role_fk") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission_mapping" ADD CONSTRAINT "role_permission_mapping_permission_fk_permissions_id_fk" FOREIGN KEY ("permission_fk") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission_mapping" ADD CONSTRAINT "role_permission_mapping_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_route_mapping" ADD CONSTRAINT "role_route_mapping_role_fk_roles_id_fk" FOREIGN KEY ("role_fk") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_route_mapping" ADD CONSTRAINT "role_route_mapping_route_fk_routes_id_fk" FOREIGN KEY ("route_fk") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_route_mapping" ADD CONSTRAINT "role_route_mapping_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_mapping" ADD CONSTRAINT "user_permission_mapping_user_fk_users_id_fk" FOREIGN KEY ("user_fk") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_mapping" ADD CONSTRAINT "user_permission_mapping_permission_fk_permissions_id_fk" FOREIGN KEY ("permission_fk") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_mapping" ADD CONSTRAINT "user_permission_mapping_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_mapping" ADD CONSTRAINT "user_permission_mapping_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite" ADD CONSTRAINT "staff_invite_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite" ADD CONSTRAINT "staff_invite_invited_by_fk_users_id_fk" FOREIGN KEY ("invited_by_fk") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite" ADD CONSTRAINT "staff_invite_invitee_fk_users_id_fk" FOREIGN KEY ("invitee_fk") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite" ADD CONSTRAINT "staff_invite_role_fk_roles_id_fk" FOREIGN KEY ("role_fk") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite" ADD CONSTRAINT "staff_invite_accepted_by_fk_users_id_fk" FOREIGN KEY ("accepted_by_fk") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite" ADD CONSTRAINT "staff_invite_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite" ADD CONSTRAINT "staff_invite_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite" ADD CONSTRAINT "staff_invite_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite_permission" ADD CONSTRAINT "staff_invite_permission_invite_fk_staff_invite_id_fk" FOREIGN KEY ("invite_fk") REFERENCES "public"."staff_invite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite_permission" ADD CONSTRAINT "staff_invite_permission_permission_fk_permissions_id_fk" FOREIGN KEY ("permission_fk") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_type_fk_notification_types_id_fk" FOREIGN KEY ("type_fk") REFERENCES "public"."notification_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_fk_users_id_fk" FOREIGN KEY ("user_fk") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_fk_users_id_fk" FOREIGN KEY ("user_fk") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_fk_notification_types_id_fk" FOREIGN KEY ("type_fk") REFERENCES "public"."notification_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_template_fk_notification_templates_id_fk" FOREIGN KEY ("template_fk") REFERENCES "public"."notification_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_fk_users_id_fk" FOREIGN KEY ("user_fk") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_session_fk_user_session_id_fk" FOREIGN KEY ("session_fk") REFERENCES "public"."user_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_legal_type" ADD CONSTRAINT "store_legal_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_legal_type" ADD CONSTRAINT "store_legal_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_legal_type" ADD CONSTRAINT "store_legal_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_category" ADD CONSTRAINT "store_category_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_category" ADD CONSTRAINT "store_category_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_category" ADD CONSTRAINT "store_category_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_owner_fk_users_id_fk" FOREIGN KEY ("owner_fk") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_store_legal_type_fk_store_legal_type_id_fk" FOREIGN KEY ("store_legal_type_fk") REFERENCES "public"."store_legal_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_store_category_fk_store_category_id_fk" FOREIGN KEY ("store_category_fk") REFERENCES "public"."store_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_country_fk_country_id_fk" FOREIGN KEY ("country_fk") REFERENCES "public"."country"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_parent_store_fk_store_id_fk" FOREIGN KEY ("parent_store_fk") REFERENCES "public"."store"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designation" ADD CONSTRAINT "designation_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designation" ADD CONSTRAINT "designation_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designation" ADD CONSTRAINT "designation_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designation" ADD CONSTRAINT "designation_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_user_mapping" ADD CONSTRAINT "store_user_mapping_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_user_mapping" ADD CONSTRAINT "store_user_mapping_user_fk_users_id_fk" FOREIGN KEY ("user_fk") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_user_mapping" ADD CONSTRAINT "store_user_mapping_designation_fk_designation_id_fk" FOREIGN KEY ("designation_fk") REFERENCES "public"."designation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_user_mapping" ADD CONSTRAINT "store_user_mapping_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "country" ADD CONSTRAINT "country_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "country" ADD CONSTRAINT "country_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "country" ADD CONSTRAINT "country_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_region_province" ADD CONSTRAINT "state_region_province_country_fk_country_id_fk" FOREIGN KEY ("country_fk") REFERENCES "public"."country"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_region_province" ADD CONSTRAINT "state_region_province_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_region_province" ADD CONSTRAINT "state_region_province_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_region_province" ADD CONSTRAINT "state_region_province_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "district" ADD CONSTRAINT "district_state_region_province_fk_state_region_province_id_fk" FOREIGN KEY ("state_region_province_fk") REFERENCES "public"."state_region_province"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "district" ADD CONSTRAINT "district_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "district" ADD CONSTRAINT "district_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "district" ADD CONSTRAINT "district_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pincode" ADD CONSTRAINT "pincode_district_fk_district_id_fk" FOREIGN KEY ("district_fk") REFERENCES "public"."district"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pincode" ADD CONSTRAINT "pincode_state_region_province_fk_state_region_province_id_fk" FOREIGN KEY ("state_region_province_fk") REFERENCES "public"."state_region_province"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pincode" ADD CONSTRAINT "pincode_country_fk_country_id_fk" FOREIGN KEY ("country_fk") REFERENCES "public"."country"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pincode" ADD CONSTRAINT "pincode_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pincode" ADD CONSTRAINT "pincode_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pincode" ADD CONSTRAINT "pincode_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity" ADD CONSTRAINT "entity_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity" ADD CONSTRAINT "entity_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity" ADD CONSTRAINT "entity_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_entity_fk_entity_id_fk" FOREIGN KEY ("entity_fk") REFERENCES "public"."entity"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_address_type_fk_address_type_id_fk" FOREIGN KEY ("address_type_fk") REFERENCES "public"."address_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_state_region_province_fk_state_region_province_id_fk" FOREIGN KEY ("state_region_province_fk") REFERENCES "public"."state_region_province"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_district_fk_district_id_fk" FOREIGN KEY ("district_fk") REFERENCES "public"."district"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_country_fk_country_id_fk" FOREIGN KEY ("country_fk") REFERENCES "public"."country"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication" ADD CONSTRAINT "communication_entity_fk_entity_id_fk" FOREIGN KEY ("entity_fk") REFERENCES "public"."entity"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication" ADD CONSTRAINT "communication_communication_type_fk_communication_type_id_fk" FOREIGN KEY ("communication_type_fk") REFERENCES "public"."communication_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication" ADD CONSTRAINT "communication_dial_country_fk_country_id_fk" FOREIGN KEY ("dial_country_fk") REFERENCES "public"."country"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication" ADD CONSTRAINT "communication_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication" ADD CONSTRAINT "communication_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication" ADD CONSTRAINT "communication_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person" ADD CONSTRAINT "contact_person_entity_fk_entity_id_fk" FOREIGN KEY ("entity_fk") REFERENCES "public"."entity"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person" ADD CONSTRAINT "contact_person_contact_person_type_fk_contact_person_type_id_fk" FOREIGN KEY ("contact_person_type_fk") REFERENCES "public"."contact_person_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person" ADD CONSTRAINT "contact_person_salutation_fk_salutation_id_fk" FOREIGN KEY ("salutation_fk") REFERENCES "public"."salutation"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person" ADD CONSTRAINT "contact_person_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person" ADD CONSTRAINT "contact_person_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person" ADD CONSTRAINT "contact_person_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_entity_fk_entity_id_fk" FOREIGN KEY ("entity_fk") REFERENCES "public"."entity"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_notes_type_fk_notes_type_id_fk" FOREIGN KEY ("notes_type_fk") REFERENCES "public"."notes_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volumes" ADD CONSTRAINT "volumes_base_volume_fk_volumes_id_fk" FOREIGN KEY ("base_volume_fk") REFERENCES "public"."volumes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volumes" ADD CONSTRAINT "volumes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volumes" ADD CONSTRAINT "volumes_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volumes" ADD CONSTRAINT "volumes_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address_type" ADD CONSTRAINT "address_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address_type" ADD CONSTRAINT "address_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address_type" ADD CONSTRAINT "address_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_type" ADD CONSTRAINT "communication_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_type" ADD CONSTRAINT "communication_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_type" ADD CONSTRAINT "communication_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes_type" ADD CONSTRAINT "notes_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes_type" ADD CONSTRAINT "notes_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes_type" ADD CONSTRAINT "notes_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person_type" ADD CONSTRAINT "contact_person_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person_type" ADD CONSTRAINT "contact_person_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_person_type" ADD CONSTRAINT "contact_person_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salutation" ADD CONSTRAINT "salutation_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salutation" ADD CONSTRAINT "salutation_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salutation" ADD CONSTRAINT "salutation_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_phone_number_idx" ON "users" USING btree ("phone_number");--> statement-breakpoint
CREATE UNIQUE INDEX "users_iam_user_id_idx" ON "users" USING btree ("iam_user_id");--> statement-breakpoint
CREATE INDEX "user_session_user_idx" ON "user_session" USING btree ("user_fk");--> statement-breakpoint
CREATE INDEX "user_session_token_idx" ON "user_session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "user_auth_provider_user_idx" ON "user_auth_provider" USING btree ("user_fk");--> statement-breakpoint
CREATE INDEX "otp_verification_identifier_purpose_idx" ON "otp_verification" USING btree ("identifier","purpose");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_code_system_idx" ON "roles" USING btree ("code") WHERE store_fk IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_code_store_idx" ON "roles" USING btree ("code","store_fk") WHERE store_fk IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_system_idx" ON "roles" USING btree ("role_name") WHERE store_fk IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_store_idx" ON "roles" USING btree ("role_name","store_fk") WHERE store_fk IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "routes_path_app_idx" ON "routes" USING btree ("route_path","app_code") WHERE app_code IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_role_mapping_global_idx" ON "user_role_mapping" USING btree ("user_fk","role_fk") WHERE store_fk IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_role_mapping_store_idx" ON "user_role_mapping" USING btree ("user_fk","role_fk","store_fk") WHERE store_fk IS NOT NULL;--> statement-breakpoint
CREATE INDEX "user_role_mapping_role_idx" ON "user_role_mapping" USING btree ("role_fk");--> statement-breakpoint
CREATE INDEX "user_permission_mapping_user_idx" ON "user_permission_mapping" USING btree ("user_fk");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_invite_pending_unique_idx" ON "staff_invite" USING btree ("store_fk","invitee_email") WHERE status = 'PENDING' AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_templates_published_idx" ON "notification_templates" USING btree ("type_fk","language") WHERE status = 'PUBLISHED' AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_templates_draft_idx" ON "notification_templates" USING btree ("type_fk","language") WHERE status = 'DRAFT' AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "push_tokens_user_fk_idx" ON "push_tokens" USING btree ("user_fk");--> statement-breakpoint
CREATE UNIQUE INDEX "push_tokens_token_idx" ON "push_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "notifications_user_fk_idx" ON "notifications" USING btree ("user_fk");--> statement-breakpoint
CREATE INDEX "notifications_user_store_idx" ON "notifications" USING btree ("user_fk","store_fk");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_fk") WHERE read_at IS NULL;--> statement-breakpoint
CREATE INDEX "notifications_retry_idx" ON "notifications" USING btree ("status","retry_count") WHERE status IN ('PENDING', 'FAILED');--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_ticket_idx" ON "notifications" USING btree ("expo_push_ticket_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_fk");--> statement-breakpoint
CREATE INDEX "audit_logs_store_idx" ON "audit_logs" USING btree ("store_fk");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "designation_code_system_idx" ON "designation" USING btree ("designation_code") WHERE store_fk IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "designation_code_store_idx" ON "designation" USING btree ("designation_code","store_fk") WHERE store_fk IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "designation_name_system_idx" ON "designation" USING btree ("designation_name") WHERE store_fk IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "designation_name_store_idx" ON "designation" USING btree ("designation_name","store_fk") WHERE store_fk IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "store_user_mapping_user_idx" ON "store_user_mapping" USING btree ("user_fk");--> statement-breakpoint
CREATE UNIQUE INDEX "store_user_mapping_one_primary_idx" ON "store_user_mapping" USING btree ("store_fk") WHERE is_primary = true;--> statement-breakpoint
CREATE UNIQUE INDEX "state_name_country_idx" ON "state_region_province" USING btree ("state_name","country_fk") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "district_name_state_idx" ON "district" USING btree ("district_name","state_region_province_fk") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "pincode_postal_code_country_idx" ON "pincode" USING btree ("postal_code","country_fk") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "pincode_city_name_idx" ON "pincode" USING btree ("city_name");--> statement-breakpoint
CREATE INDEX "pincode_district_idx" ON "pincode" USING btree ("district_fk");--> statement-breakpoint
CREATE INDEX "pincode_state_idx" ON "pincode" USING btree ("state_region_province_fk");--> statement-breakpoint
CREATE INDEX "address_entity_record_idx" ON "address" USING btree ("entity_fk","record_id");--> statement-breakpoint
CREATE INDEX "address_entity_record_active_idx" ON "address" USING btree ("entity_fk","record_id") WHERE is_active = true;--> statement-breakpoint
CREATE UNIQUE INDEX "address_one_default_idx" ON "address" USING btree ("entity_fk","record_id") WHERE is_default_address = true AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "address_one_billing_idx" ON "address" USING btree ("entity_fk","record_id") WHERE is_billing_address = true AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "communication_entity_record_idx" ON "communication" USING btree ("entity_fk","record_id");--> statement-breakpoint
CREATE INDEX "communication_entity_record_active_idx" ON "communication" USING btree ("entity_fk","record_id") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "contact_person_entity_record_idx" ON "contact_person" USING btree ("entity_fk","record_id");--> statement-breakpoint
CREATE INDEX "contact_person_entity_record_active_idx" ON "contact_person" USING btree ("entity_fk","record_id") WHERE is_active = true;--> statement-breakpoint
CREATE UNIQUE INDEX "contact_person_one_primary_idx" ON "contact_person" USING btree ("entity_fk","record_id") WHERE is_primary = true AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "notes_entity_record_idx" ON "notes" USING btree ("entity_fk","record_id");--> statement-breakpoint
CREATE INDEX "notes_entity_record_active_idx" ON "notes" USING btree ("entity_fk","record_id") WHERE is_active = true;