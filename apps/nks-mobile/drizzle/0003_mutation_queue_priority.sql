ALTER TABLE `mutation_queue` ADD `priority` integer NOT NULL DEFAULT 5;
--> statement-breakpoint
CREATE INDEX `idx_mq_priority` ON `mutation_queue` (`priority`);
