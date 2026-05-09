CREATE TABLE `stores` (
  `id` integer PRIMARY KEY NOT NULL,
  `guuid` text NOT NULL,
  `name` text NOT NULL,
  `address` text,
  `phone` text,
  `replication_status` text NOT NULL DEFAULT 'pending',
  `replication_error` text,
  `last_replicated_at` integer,
  `last_accessed_at` integer,
  `is_default_store` integer NOT NULL DEFAULT 0,
  `is_synced_for_offline` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stores_guuid_unique` ON `stores` (`guuid`);
--> statement-breakpoint
CREATE INDEX `idx_stores_default` ON `stores` (`is_default_store`);
--> statement-breakpoint
CREATE INDEX `idx_stores_status` ON `stores` (`replication_status`);
--> statement-breakpoint
CREATE TABLE `store_sync_progress` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `store_id` integer NOT NULL,
  `entity_type` text NOT NULL,
  `progress_percent` integer NOT NULL DEFAULT 0,
  `rows_downloaded` integer NOT NULL DEFAULT 0,
  `rows_total` integer,
  `cursor` text,
  `last_progress_at` integer,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_sync_progress_unique` ON `store_sync_progress` (`store_id`, `entity_type`);
--> statement-breakpoint
CREATE TABLE `roles` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `store_id` integer NOT NULL,
  `code` text NOT NULL,
  `name` text NOT NULL,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_store_code_unique` ON `roles` (`store_id`, `code`);
--> statement-breakpoint
CREATE TABLE `permissions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `store_id` integer NOT NULL,
  `code` text NOT NULL,
  `name` text NOT NULL,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `permissions_store_code_unique` ON `permissions` (`store_id`, `code`);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `store_id` integer NOT NULL,
  `role_code` text NOT NULL,
  `permission_code` text NOT NULL,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `role_permissions_unique` ON `role_permissions` (`store_id`, `role_code`, `permission_code`);
--> statement-breakpoint
CREATE TABLE `user_store_roles` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL,
  `store_id` integer NOT NULL,
  `role_code` text NOT NULL,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_store_roles_unique` ON `user_store_roles` (`user_id`, `store_id`, `role_code`);
--> statement-breakpoint
CREATE INDEX `idx_user_store_roles_user_store` ON `user_store_roles` (`user_id`, `store_id`);
--> statement-breakpoint
ALTER TABLE `mutation_queue` ADD COLUMN `store_id` integer;
--> statement-breakpoint
CREATE INDEX `idx_mq_store_status` ON `mutation_queue` (`store_id`, `status`);
