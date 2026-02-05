ALTER TABLE `users` ADD COLUMN `false_report_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `restricted_until` integer;
