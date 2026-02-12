-- Add api_metrics table for request monitoring (5-minute bucketed)
CREATE TABLE IF NOT EXISTS `api_metrics` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `bucket` text NOT NULL,
  `endpoint` text NOT NULL,
  `method` text NOT NULL,
  `request_count` integer NOT NULL DEFAULT 0,
  `error_count` integer NOT NULL DEFAULT 0,
  `total_duration_ms` integer NOT NULL DEFAULT 0,
  `max_duration_ms` integer NOT NULL DEFAULT 0,
  `status_2xx` integer NOT NULL DEFAULT 0,
  `status_4xx` integer NOT NULL DEFAULT 0,
  `status_5xx` integer NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS `api_metrics_bucket_endpoint_method_idx` ON `api_metrics` (`bucket`, `endpoint`, `method`);
CREATE INDEX IF NOT EXISTS `api_metrics_bucket_idx` ON `api_metrics` (`bucket`);
