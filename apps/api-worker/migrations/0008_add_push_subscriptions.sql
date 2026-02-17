CREATE TABLE IF NOT EXISTS `push_subscriptions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `endpoint` text NOT NULL,
  `p256dh` text NOT NULL,
  `auth` text NOT NULL,
  `created_at` integer NOT NULL,
  `expires_at` integer,
  `last_used_at` integer,
  `fail_count` integer NOT NULL DEFAULT 0,
  `user_agent` text
);

CREATE INDEX IF NOT EXISTS `push_sub_user_idx` ON `push_subscriptions` (`user_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `push_sub_endpoint_idx` ON `push_subscriptions` (`endpoint`);
