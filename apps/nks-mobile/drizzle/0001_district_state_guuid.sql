PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_district` (
	`id` integer PRIMARY KEY NOT NULL,
	`guuid` text NOT NULL,
	`district_name` text NOT NULL,
	`district_code` text,
	`lgd_code` text,
	`state_guuid` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
INSERT INTO `__new_district`(`id`, `guuid`, `district_name`, `district_code`, `lgd_code`, `state_guuid`, `is_active`, `updated_at`, `deleted_at`) SELECT `id`, `guuid`, `district_name`, `district_code`, `lgd_code`, '', `is_active`, `updated_at`, `deleted_at` FROM `district`;
--> statement-breakpoint
DROP TABLE `district`;
--> statement-breakpoint
ALTER TABLE `__new_district` RENAME TO `district`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
CREATE UNIQUE INDEX `district_guuid_unique` ON `district` (`guuid`);
--> statement-breakpoint
CREATE INDEX `idx_district_state_guuid` ON `district` (`state_guuid`);
