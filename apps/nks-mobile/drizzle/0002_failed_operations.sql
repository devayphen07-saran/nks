CREATE TABLE `failed_operations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`idempotency_key` text NOT NULL,
	`operation` text NOT NULL,
	`entity` text NOT NULL,
	`payload` text NOT NULL,
	`error_code` integer,
	`error_msg` text,
	`device_id` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`failed_at` integer NOT NULL,
	`resolved` integer DEFAULT 0 NOT NULL,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `failed_operations_idempotency_key_unique` ON `failed_operations` (`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `idx_fo_entity` ON `failed_operations` (`entity`);
--> statement-breakpoint
CREATE INDEX `idx_fo_resolved` ON `failed_operations` (`resolved`);
