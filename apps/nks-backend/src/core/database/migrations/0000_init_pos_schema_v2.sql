CREATE TYPE "public"."audit_action_type" AS ENUM('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'TOKEN_REFRESH', 'TOKEN_REVOKE', 'PASSWORD_RESET', 'EMAIL_VERIFIED', 'PHONE_VERIFIED', 'OTP_REQUESTED', 'OTP_VERIFIED', 'OTP_FAILED', 'INVITE_SENT', 'INVITE_ACCEPTED', 'INVITE_REVOKED', 'ROLE_ASSIGNED', 'ROLE_REVOKED', 'PERMISSION_GRANTED', 'PERMISSION_REVOKED', 'STORE_CREATED', 'STORE_DELETED', 'ACCOUNT_BLOCKED', 'ACCOUNT_UNBLOCKED');--> statement-breakpoint
CREATE TYPE "public"."auth_method" AS ENUM('OTP', 'PASSWORD', 'GOOGLE');--> statement-breakpoint
CREATE TYPE "public"."device_type" AS ENUM('IOS', 'ANDROID');--> statement-breakpoint
CREATE TYPE "public"."login_status" AS ENUM('SUCCESS', 'FAILED', 'BLOCKED');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('WEBSOCKET', 'PUSH', 'BOTH');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ');--> statement-breakpoint
CREATE TYPE "public"."notification_template_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('LOGIN', 'PHONE_VERIFY', 'EMAIL_VERIFY', 'RESET_PASSWORD');--> statement-breakpoint
CREATE TYPE "public"."route_type" AS ENUM('sidebar', 'tab', 'screen', 'modal');--> statement-breakpoint
CREATE TYPE "public"."session_device_type" AS ENUM('IOS', 'ANDROID', 'WEB');--> statement-breakpoint
CREATE TYPE "public"."staff_invite_status" AS ENUM('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."store_status" AS ENUM('ACTIVE', 'SUSPENDED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."volume_type" AS ENUM('weight', 'volume', 'length', 'count', 'area');--> statement-breakpoint
CREATE TYPE "public"."filing_frequency" AS ENUM('MONTHLY', 'QUARTERLY', 'ANNUALLY');--> statement-breakpoint
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
	"login_method" "auth_method",
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
	"identifier" text NOT NULL,
	"request_count" smallint DEFAULT 1 NOT NULL,
	"window_expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "otp_request_log_guuid_unique" UNIQUE("guuid")
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
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
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
	"assigned_by" bigint,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone
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
	"entity_code" varchar(50) NOT NULL,
	"can_view" boolean DEFAULT false NOT NULL,
	"can_create" boolean DEFAULT false NOT NULL,
	"can_edit" boolean DEFAULT false NOT NULL,
	"can_delete" boolean DEFAULT false NOT NULL,
	"allow" boolean DEFAULT false NOT NULL,
	CONSTRAINT "role_entity_permission_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "role_entity_permission_unique_idx" UNIQUE("role_fk","entity_code")
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
	"iam_store_id" varchar(64),
	"store_name" varchar(255) NOT NULL,
	"store_code" varchar(50),
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
CREATE TABLE "hsn_codes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guuid" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"sort_order" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"hsn_code" varchar(10) NOT NULL,
	"digits" integer NOT NULL,
	"description" varchar(1000) NOT NULL,
	"display_name" varchar(255),
	"default_gst_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"type" varchar(10) DEFAULT 'HSN' NOT NULL,
	"is_exempted" boolean DEFAULT false NOT NULL,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "hsn_codes_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "hsn_codes_hsn_code_unique" UNIQUE("hsn_code")
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
	CONSTRAINT "tax_levels_code_unique" UNIQUE("code")
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
	"label" varchar(255),
	"filing_frequency" "filing_frequency" DEFAULT 'MONTHLY' NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "tax_registrations_guuid_unique" UNIQUE("guuid")
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
	"store_fk" bigint NOT NULL,
	"hsn_code_fk" bigint NOT NULL,
	"gst_rate" numeric(10, 3) NOT NULL,
	"cgst_rate" numeric(10, 3) NOT NULL,
	"sgst_rate" numeric(10, 3) NOT NULL,
	"igst_rate" numeric(10, 3),
	"cess_rate" numeric(10, 3) DEFAULT '0',
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "tax_rate_master_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "tax_rate_master_gst_rate_positive" CHECK (gst_rate >= 0),
	CONSTRAINT "tax_rate_master_cgst_sgst_sum_chk" CHECK (cgst_rate + sgst_rate = gst_rate),
	CONSTRAINT "tax_rate_master_date_range_chk" CHECK (effective_from <= effective_to OR effective_to IS NULL)
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
	"store_fk" bigint NOT NULL,
	"transaction_date" date NOT NULL,
	"gst_rate" numeric(5, 2) NOT NULL,
	"total_taxable_amount" numeric(15, 2) NOT NULL,
	"total_cgst" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_sgst" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_igst" numeric(15, 2) DEFAULT '0',
	"total_cess" numeric(15, 2) DEFAULT '0',
	"tax_collected" numeric(15, 2) NOT NULL,
	"created_by" bigint,
	"modified_by" bigint,
	"deleted_by" bigint,
	CONSTRAINT "daily_tax_summary_guuid_unique" UNIQUE("guuid"),
	CONSTRAINT "daily_tax_summary_gst_rate_valid_chk" CHECK (gst_rate IN (0, 5, 12, 18, 28)),
	CONSTRAINT "daily_tax_summary_tax_collected_chk" CHECK (tax_collected = total_cgst + total_sgst + total_igst + COALESCE(total_cess, 0)),
	CONSTRAINT "daily_tax_summary_amounts_positive_chk" CHECK (total_taxable_amount >= 0 AND total_cgst >= 0 AND total_sgst >= 0 AND tax_collected >= 0)
);
--> statement-breakpoint
CREATE TABLE "transaction_tax_lines" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"store_fk" bigint NOT NULL,
	"tax_registration_fk" bigint,
	"hsn_code_fk" bigint NOT NULL,
	"tax_rate_master_fk" bigint,
	"transaction_ref" bigint NOT NULL,
	"transaction_item_ref" bigint,
	"transaction_date" date NOT NULL,
	"taxable_amount" numeric(15, 3) NOT NULL,
	"cgst_amount" numeric(15, 3) DEFAULT '0' NOT NULL,
	"sgst_amount" numeric(15, 3) DEFAULT '0' NOT NULL,
	"igst_amount" numeric(15, 3) DEFAULT '0',
	"cess_amount" numeric(15, 3) DEFAULT '0',
	"total_tax" numeric(15, 3) NOT NULL,
	"applied_gst_rate" numeric(10, 3) NOT NULL,
	CONSTRAINT "transaction_tax_lines_total_tax_chk" CHECK (total_tax = cgst_amount + sgst_amount + COALESCE(igst_amount, 0) + COALESCE(cess_amount, 0)),
	CONSTRAINT "transaction_tax_lines_amounts_positive_chk" CHECK (taxable_amount >= 0 AND cgst_amount >= 0 AND sgst_amount >= 0 AND total_tax >= 0),
	CONSTRAINT "transaction_tax_lines_rate_positive_chk" CHECK (applied_gst_rate >= 0)
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
ALTER TABLE "role_entity_permission" ADD CONSTRAINT "role_entity_permission_role_fk_roles_id_fk" FOREIGN KEY ("role_fk") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_fk_users_id_fk" FOREIGN KEY ("user_fk") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_fk_users_id_fk" FOREIGN KEY ("user_fk") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_session_fk_user_session_id_fk" FOREIGN KEY ("session_fk") REFERENCES "public"."user_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_legal_type" ADD CONSTRAINT "store_legal_type_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_legal_type" ADD CONSTRAINT "store_legal_type_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_legal_type" ADD CONSTRAINT "store_legal_type_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_category" ADD CONSTRAINT "store_category_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_category" ADD CONSTRAINT "store_category_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_category" ADD CONSTRAINT "store_category_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "store_operating_hours" ADD CONSTRAINT "store_operating_hours_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_operating_hours" ADD CONSTRAINT "store_operating_hours_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_operating_hours" ADD CONSTRAINT "store_operating_hours_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_operating_hours" ADD CONSTRAINT "store_operating_hours_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "hsn_codes" ADD CONSTRAINT "hsn_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hsn_codes" ADD CONSTRAINT "hsn_codes_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hsn_codes" ADD CONSTRAINT "hsn_codes_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "tax_registrations" ADD CONSTRAINT "tax_registrations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_registrations" ADD CONSTRAINT "tax_registrations_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_registrations" ADD CONSTRAINT "tax_registrations_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD CONSTRAINT "tax_rate_master_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD CONSTRAINT "tax_rate_master_hsn_code_fk_hsn_codes_id_fk" FOREIGN KEY ("hsn_code_fk") REFERENCES "public"."hsn_codes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD CONSTRAINT "tax_rate_master_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD CONSTRAINT "tax_rate_master_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rate_master" ADD CONSTRAINT "tax_rate_master_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tax_summary" ADD CONSTRAINT "daily_tax_summary_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tax_summary" ADD CONSTRAINT "daily_tax_summary_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tax_summary" ADD CONSTRAINT "daily_tax_summary_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tax_summary" ADD CONSTRAINT "daily_tax_summary_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD CONSTRAINT "transaction_tax_lines_store_fk_store_id_fk" FOREIGN KEY ("store_fk") REFERENCES "public"."store"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD CONSTRAINT "transaction_tax_lines_tax_registration_fk_tax_registrations_id_fk" FOREIGN KEY ("tax_registration_fk") REFERENCES "public"."tax_registrations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD CONSTRAINT "transaction_tax_lines_hsn_code_fk_hsn_codes_id_fk" FOREIGN KEY ("hsn_code_fk") REFERENCES "public"."hsn_codes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tax_lines" ADD CONSTRAINT "transaction_tax_lines_tax_rate_master_fk_tax_rate_master_id_fk" FOREIGN KEY ("tax_rate_master_fk") REFERENCES "public"."tax_rate_master"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_phone_number_idx" ON "users" USING btree ("phone_number");--> statement-breakpoint
CREATE UNIQUE INDEX "users_iam_user_id_idx" ON "users" USING btree ("iam_user_id");--> statement-breakpoint
CREATE INDEX "users_blocked_by_idx" ON "users" USING btree ("blocked_by");--> statement-breakpoint
CREATE INDEX "users_profile_completed_idx" ON "users" USING btree ("profile_completed");--> statement-breakpoint
CREATE INDEX "user_session_user_idx" ON "user_session" USING btree ("user_fk");--> statement-breakpoint
CREATE INDEX "user_session_token_idx" ON "user_session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "user_auth_provider_user_idx" ON "user_auth_provider" USING btree ("user_fk");--> statement-breakpoint
CREATE UNIQUE INDEX "user_auth_provider_user_provider_unique" ON "user_auth_provider" USING btree ("user_fk","provider_id");--> statement-breakpoint
CREATE INDEX "otp_verification_identifier_purpose_idx" ON "otp_verification" USING btree ("identifier","purpose");--> statement-breakpoint
CREATE INDEX "otp_verification_auth_provider_idx" ON "otp_verification" USING btree ("auth_provider_fk");--> statement-breakpoint
CREATE INDEX "otp_request_log_identifier_idx" ON "otp_request_log" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_code_system_idx" ON "roles" USING btree ("code") WHERE store_fk IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_code_store_idx" ON "roles" USING btree ("code","store_fk") WHERE store_fk IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_system_idx" ON "roles" USING btree ("role_name") WHERE store_fk IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_store_idx" ON "roles" USING btree ("role_name","store_fk") WHERE store_fk IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "routes_path_app_idx" ON "routes" USING btree ("route_path","app_code") WHERE app_code IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_role_mapping_global_idx" ON "user_role_mapping" USING btree ("user_fk","role_fk") WHERE store_fk IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_role_mapping_store_idx" ON "user_role_mapping" USING btree ("user_fk","role_fk","store_fk") WHERE store_fk IS NOT NULL;--> statement-breakpoint
CREATE INDEX "user_role_mapping_role_idx" ON "user_role_mapping" USING btree ("role_fk");--> statement-breakpoint
CREATE INDEX "user_role_mapping_assigned_by_idx" ON "user_role_mapping" USING btree ("assigned_by");--> statement-breakpoint
CREATE INDEX "role_permission_mapping_permission_idx" ON "role_permission_mapping" USING btree ("permission_fk");--> statement-breakpoint
CREATE INDEX "role_permission_mapping_assigned_by_idx" ON "role_permission_mapping" USING btree ("assigned_by");--> statement-breakpoint
CREATE INDEX "role_entity_permission_role_entity_idx" ON "role_entity_permission" USING btree ("role_fk","entity_code");--> statement-breakpoint
CREATE INDEX "role_entity_permission_role_idx" ON "role_entity_permission" USING btree ("role_fk");--> statement-breakpoint
CREATE INDEX "role_entity_permission_entity_idx" ON "role_entity_permission" USING btree ("entity_code");--> statement-breakpoint
CREATE INDEX "role_entity_permission_active_idx" ON "role_entity_permission" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "role_route_mapping_route_idx" ON "role_route_mapping" USING btree ("route_fk");--> statement-breakpoint
CREATE INDEX "user_permission_mapping_user_idx" ON "user_permission_mapping" USING btree ("user_fk");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_invite_pending_unique_idx" ON "staff_invite" USING btree ("store_fk","invitee_email") WHERE status = 'PENDING' AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_templates_published_idx" ON "notification_templates" USING btree ("type_fk","language") WHERE status = 'PUBLISHED' AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_templates_draft_idx" ON "notification_templates" USING btree ("type_fk","language") WHERE status = 'DRAFT' AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "push_tokens_user_fk_idx" ON "push_tokens" USING btree ("user_fk");--> statement-breakpoint
CREATE UNIQUE INDEX "push_tokens_token_idx" ON "push_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_fk_idx" ON "notifications" USING btree ("user_fk");--> statement-breakpoint
CREATE INDEX "notifications_user_store_idx" ON "notifications" USING btree ("user_fk","store_fk");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_fk") WHERE read_at IS NULL;--> statement-breakpoint
CREATE INDEX "notifications_retry_idx" ON "notifications" USING btree ("status","retry_count") WHERE status IN ('PENDING', 'FAILED');--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_ticket_idx" ON "notifications" USING btree ("expo_push_ticket_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_fk");--> statement-breakpoint
CREATE INDEX "audit_logs_store_idx" ON "audit_logs" USING btree ("store_fk");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_store_action_idx" ON "audit_logs" USING btree ("store_fk","action");--> statement-breakpoint
CREATE UNIQUE INDEX "designation_code_system_idx" ON "designation" USING btree ("designation_code") WHERE store_fk IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "designation_code_store_idx" ON "designation" USING btree ("designation_code","store_fk") WHERE store_fk IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "designation_name_system_idx" ON "designation" USING btree ("designation_name") WHERE store_fk IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "designation_name_store_idx" ON "designation" USING btree ("designation_name","store_fk") WHERE store_fk IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "designation_store_fk_idx" ON "designation" USING btree ("store_fk");--> statement-breakpoint
CREATE INDEX "store_user_mapping_user_idx" ON "store_user_mapping" USING btree ("user_fk");--> statement-breakpoint
CREATE INDEX "store_user_mapping_designation_idx" ON "store_user_mapping" USING btree ("designation_fk");--> statement-breakpoint
CREATE INDEX "store_user_mapping_assigned_by_idx" ON "store_user_mapping" USING btree ("assigned_by");--> statement-breakpoint
CREATE UNIQUE INDEX "store_user_mapping_one_primary_idx" ON "store_user_mapping" USING btree ("store_fk") WHERE is_primary = true;--> statement-breakpoint
CREATE INDEX "store_operating_hours_store_idx" ON "store_operating_hours" USING btree ("store_fk");--> statement-breakpoint
CREATE INDEX "store_operating_hours_day_idx" ON "store_operating_hours" USING btree ("day_of_week");--> statement-breakpoint
CREATE INDEX "store_operating_hours_store_day_idx" ON "store_operating_hours" USING btree ("store_fk","day_of_week");--> statement-breakpoint
CREATE INDEX "store_operating_hours_closed_idx" ON "store_operating_hours" USING btree ("is_closed");--> statement-breakpoint
CREATE UNIQUE INDEX "state_name_country_idx" ON "state_region_province" USING btree ("state_name","country_fk") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "district_name_state_idx" ON "district" USING btree ("district_name","state_region_province_fk") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "pincode_postal_code_country_idx" ON "pincode" USING btree ("postal_code","country_fk") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "pincode_city_name_idx" ON "pincode" USING btree ("city_name");--> statement-breakpoint
CREATE INDEX "pincode_district_idx" ON "pincode" USING btree ("district_fk");--> statement-breakpoint
CREATE INDEX "pincode_state_idx" ON "pincode" USING btree ("state_region_province_fk");--> statement-breakpoint
CREATE INDEX "address_entity_record_idx" ON "address" USING btree ("entity_fk","record_id");--> statement-breakpoint
CREATE INDEX "address_entity_record_active_idx" ON "address" USING btree ("entity_fk","record_id") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "address_entity_idx" ON "address" USING btree ("entity_fk");--> statement-breakpoint
CREATE INDEX "address_record_idx" ON "address" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "address_type_idx" ON "address" USING btree ("address_type_fk");--> statement-breakpoint
CREATE INDEX "address_country_idx" ON "address" USING btree ("country_fk");--> statement-breakpoint
CREATE INDEX "address_state_idx" ON "address" USING btree ("state_region_province_fk");--> statement-breakpoint
CREATE INDEX "address_district_idx" ON "address" USING btree ("district_fk");--> statement-breakpoint
CREATE UNIQUE INDEX "address_one_default_idx" ON "address" USING btree ("entity_fk","record_id") WHERE is_default_address = true AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "address_one_billing_idx" ON "address" USING btree ("entity_fk","record_id") WHERE is_billing_address = true AND deleted_at IS NULL;--> statement-breakpoint
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
CREATE INDEX "hsn_codes_type_code_idx" ON "hsn_codes" USING btree ("type","hsn_code");--> statement-breakpoint
CREATE INDEX "hsn_codes_digits_idx" ON "hsn_codes" USING btree ("digits");--> statement-breakpoint
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
CREATE INDEX "tax_registrations_store_idx" ON "tax_registrations" USING btree ("store_fk");--> statement-breakpoint
CREATE INDEX "tax_registrations_agency_idx" ON "tax_registrations" USING btree ("tax_agency_fk");--> statement-breakpoint
CREATE INDEX "tax_registrations_number_idx" ON "tax_registrations" USING btree ("registration_number");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_rate_master_active_idx" ON "tax_rate_master" USING btree ("store_fk","hsn_code_fk") WHERE is_active = true AND deleted_at IS NULL AND effective_to IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_tax_summary_store_date_rate_unique" ON "daily_tax_summary" USING btree ("store_fk","transaction_date","gst_rate");--> statement-breakpoint
CREATE INDEX "transaction_tax_lines_store_date_idx" ON "transaction_tax_lines" USING btree ("store_fk","transaction_date");--> statement-breakpoint
CREATE INDEX "transaction_tax_lines_transaction_ref_idx" ON "transaction_tax_lines" USING btree ("transaction_ref");--> statement-breakpoint
CREATE INDEX "transaction_tax_lines_hsn_idx" ON "transaction_tax_lines" USING btree ("hsn_code_fk");--> statement-breakpoint
CREATE INDEX "transaction_tax_lines_registration_idx" ON "transaction_tax_lines" USING btree ("tax_registration_fk");