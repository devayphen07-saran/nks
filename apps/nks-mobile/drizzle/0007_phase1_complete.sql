-- Phase 1 completion: missing columns on existing tables + 5 new tables

-- ── stores: add state-machine + freshness columns (FIX #4, #9) ────────────
ALTER TABLE `stores` ADD COLUMN `data_freshness_limits` text;
--> statement-breakpoint
ALTER TABLE `stores` ADD COLUMN `current_state` text DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE `stores` ADD COLUMN `previous_state` text;
--> statement-breakpoint
ALTER TABLE `stores` ADD COLUMN `state_transition_at` integer;
--> statement-breakpoint
ALTER TABLE `stores` ADD COLUMN `stuck_since` integer;
--> statement-breakpoint
ALTER TABLE `stores` ADD COLUMN `updated_at` integer NOT NULL DEFAULT 0;
--> statement-breakpoint

-- ── store_sync_progress: add timestamp-based + status columns (FIX #2) ───
ALTER TABLE `store_sync_progress` ADD COLUMN `last_sync_timestamp` integer;
--> statement-breakpoint
ALTER TABLE `store_sync_progress` ADD COLUMN `last_change_set_id` text;
--> statement-breakpoint
ALTER TABLE `store_sync_progress` ADD COLUMN `status` text NOT NULL DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE `store_sync_progress` ADD COLUMN `error` text;
--> statement-breakpoint
ALTER TABLE `store_sync_progress` ADD COLUMN `updated_at` integer NOT NULL DEFAULT 0;
--> statement-breakpoint

-- ── permissions: add data-scope columns (FIX #6) ─────────────────────────
ALTER TABLE `permissions` ADD COLUMN `data_scope` text;
--> statement-breakpoint
ALTER TABLE `permissions` ADD COLUMN `scope_field` text;
--> statement-breakpoint

-- ── user_store_roles: add assigned_at ─────────────────────────────────────
ALTER TABLE `user_store_roles` ADD COLUMN `assigned_at` integer NOT NULL DEFAULT 0;
--> statement-breakpoint

-- ── mutation_queue: add all missing columns (FIX #3, #5, #10, #11, #12) ──
ALTER TABLE `mutation_queue` ADD COLUMN `client_op_id` text;
--> statement-breakpoint
ALTER TABLE `mutation_queue` ADD COLUMN `entity_id` text;
--> statement-breakpoint
ALTER TABLE `mutation_queue` ADD COLUMN `version` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `mutation_queue` ADD COLUMN `base_version` integer;
--> statement-breakpoint
ALTER TABLE `mutation_queue` ADD COLUMN `user_id` text;
--> statement-breakpoint
ALTER TABLE `mutation_queue` ADD COLUMN `timestamp` integer;
--> statement-breakpoint
ALTER TABLE `mutation_queue` ADD COLUMN `changed_fields` text;
--> statement-breakpoint
ALTER TABLE `mutation_queue` ADD COLUMN `previous_value` text;
--> statement-breakpoint
ALTER TABLE `mutation_queue` ADD COLUMN `conflict_data` text;
--> statement-breakpoint
ALTER TABLE `mutation_queue` ADD COLUMN `resolved_at` integer;
--> statement-breakpoint
ALTER TABLE `mutation_queue` ADD COLUMN `resolution` text;
--> statement-breakpoint
ALTER TABLE `mutation_queue` ADD COLUMN `server_timestamp` integer;
--> statement-breakpoint
ALTER TABLE `mutation_queue` ADD COLUMN `server_receipt_id` text;
--> statement-breakpoint
ALTER TABLE `mutation_queue` ADD COLUMN `updated_at` integer;
--> statement-breakpoint

-- ── mutation_queue_log (FIX #10) ──────────────────────────────────────────
CREATE TABLE `mutation_queue_log` (
  `id`               integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `idempotency_key`  text NOT NULL,
  `mutation_id`      integer,
  `result_id`        text,
  `status`           text NOT NULL,
  `server_timestamp` integer,
  `created_at`       integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mqlog_idempotency_key_unique` ON `mutation_queue_log` (`idempotency_key`);
--> statement-breakpoint

-- ── store_data_staging (FIX #8) ───────────────────────────────────────────
CREATE TABLE `store_data_staging` (
  `id`               integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `store_id`         integer NOT NULL,
  `entity_type`      text NOT NULL,
  `entity_id`        text NOT NULL,
  `entity_data`      text NOT NULL,
  `operation`        text NOT NULL,
  `server_timestamp` integer,
  `version`          integer,
  `created_at`       integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_staging_store_type` ON `store_data_staging` (`store_id`, `entity_type`);
--> statement-breakpoint

-- ── sync_metadata (FIX #4, #9, #15) ──────────────────────────────────────
CREATE TABLE `sync_metadata` (
  `id`                     integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `store_id`               integer NOT NULL,
  `last_sync_timestamp`    integer,
  `recommended_refresh_at` integer,
  `required_refresh_at`    integer,
  `commit_log_phase`       text,
  `commit_log_data`        text,
  `config_version`         integer,
  `config_hash`            text,
  `config_fetched_at`      integer,
  `checksum_hash`          text,
  `rows_total`             integer,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_metadata_store_id_unique` ON `sync_metadata` (`store_id`);
--> statement-breakpoint

-- ── store_cache (FIX #11) ─────────────────────────────────────────────────
CREATE TABLE `store_cache` (
  `id`              integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `store_id`        integer NOT NULL,
  `store_guuid`     text NOT NULL,
  `store_name`      text NOT NULL,
  `estimated_size`  integer,
  `last_accessed_at` integer,
  `expires_at`      integer,
  `is_valid`        integer NOT NULL DEFAULT 1,
  `created_at`      integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_cache_store_id_unique` ON `store_cache` (`store_id`);
--> statement-breakpoint

-- ── permission_constraints (FIX #3, #6) ──────────────────────────────────
CREATE TABLE `permission_constraints` (
  `id`               integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `store_id`         integer NOT NULL,
  `permission_code`  text NOT NULL,
  `constraint_type`  text NOT NULL,
  `constraint_field` text,
  `constraint_value` text,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `perm_constraints_unique` ON `permission_constraints` (`store_id`, `permission_code`, `constraint_type`, `constraint_field`);
