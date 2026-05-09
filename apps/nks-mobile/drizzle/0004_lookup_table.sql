CREATE TABLE `lookup` (
	`id`               integer PRIMARY KEY NOT NULL,
	`guuid`            text NOT NULL,
	`lookup_type_id`   integer NOT NULL,
	`lookup_type_code` text NOT NULL,
	`code`             text NOT NULL,
	`label`            text NOT NULL,
	`description`      text,
	`store_id`         integer,
	`is_active`        integer NOT NULL DEFAULT 1,
	`is_system`        integer NOT NULL DEFAULT 0,
	`is_hidden`        integer NOT NULL DEFAULT 0,
	`sort_order`       integer,
	`version`          integer NOT NULL DEFAULT 1,
	`updated_at`       text NOT NULL,
	`deleted_at`       text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lookup_guuid_unique` ON `lookup` (`guuid`);
--> statement-breakpoint
CREATE INDEX `idx_lookup_type_code` ON `lookup` (`lookup_type_code`);
--> statement-breakpoint
CREATE INDEX `idx_lookup_type_store` ON `lookup` (`lookup_type_code`, `store_id`);
--> statement-breakpoint
CREATE INDEX `idx_lookup_cursor` ON `lookup` (`updated_at`, `id`);
