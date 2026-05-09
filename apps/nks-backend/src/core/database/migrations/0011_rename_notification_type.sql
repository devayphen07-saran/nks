-- Rename notification_types → notification_type for consistency with all other _type reference tables.
-- (address_type, communication_type, designation_type, entity_type are all singular)

ALTER TABLE "notification_types" RENAME TO "notification_type";--> statement-breakpoint

-- Rename own constraints to match new table name
ALTER TABLE "notification_type" RENAME CONSTRAINT "notification_types_guuid_unique" TO "notification_type_guuid_unique";--> statement-breakpoint
ALTER TABLE "notification_type" RENAME CONSTRAINT "notification_types_code_unique" TO "notification_type_code_unique";--> statement-breakpoint

-- Rename FK constraints on referencing tables so Drizzle schema stays in sync
ALTER TABLE "notifications" RENAME CONSTRAINT "notifications_type_fk_notification_types_id_fk" TO "notifications_type_fk_notification_type_id_fk";--> statement-breakpoint
ALTER TABLE "notification_templates" RENAME CONSTRAINT "notification_templates_type_fk_notification_types_id_fk" TO "notification_templates_type_fk_notification_type_id_fk";