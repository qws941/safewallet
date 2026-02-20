CREATE UNIQUE INDEX IF NOT EXISTS `attendance_external_site_checkin_unique` ON `attendances` (`external_worker_id`,`site_id`,`checkin_at`);
