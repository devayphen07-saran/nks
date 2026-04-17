CREATE TABLE `district` (
	`id` integer PRIMARY KEY NOT NULL,
	`guuid` text NOT NULL,
	`district_name` text NOT NULL,
	`district_code` text,
	`lgd_code` text,
	`state_fk` integer NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `district_guuid_unique` ON `district` (`guuid`);--> statement-breakpoint
CREATE INDEX `idx_district_state_fk` ON `district` (`state_fk`);--> statement-breakpoint
CREATE TABLE `mutation_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`idempotency_key` text NOT NULL,
	`operation` text NOT NULL,
	`entity` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`retries` integer DEFAULT 0 NOT NULL,
	`max_retries` integer DEFAULT 5 NOT NULL,
	`next_retry_at` integer,
	`last_error_code` integer,
	`last_error_msg` text,
	`device_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`synced_at` integer,
	`expires_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mutation_queue_idempotency_key_unique` ON `mutation_queue` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_mq_status` ON `mutation_queue` (`status`);--> statement-breakpoint
CREATE INDEX `idx_mq_next_retry` ON `mutation_queue` (`next_retry_at`);--> statement-breakpoint
CREATE TABLE `state` (
	`id` integer PRIMARY KEY NOT NULL,
	`guuid` text NOT NULL,
	`state_name` text NOT NULL,
	`state_code` text NOT NULL,
	`gst_state_code` text,
	`is_union_territory` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `state_guuid_unique` ON `state` (`guuid`);--> statement-breakpoint
CREATE INDEX `idx_state_code` ON `state` (`state_code`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
