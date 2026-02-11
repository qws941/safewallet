-- Migration: 0006_add_missing_user_columns
-- Description: Add missing user table columns (can_review, can_export_data, deletion_requested_at, deleted_at)
-- Generated: 2026-02-12

ALTER TABLE users ADD COLUMN can_review INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN can_export_data INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN deletion_requested_at INTEGER;
ALTER TABLE users ADD COLUMN deleted_at INTEGER;
