-- Migration: Add priority and description to actions table
-- Purpose: Support corrective action priority levels and descriptions
-- Date: 2026-02-11

ALTER TABLE actions ADD COLUMN priority TEXT CHECK(priority IN ('HIGH', 'MEDIUM', 'LOW'));
ALTER TABLE actions ADD COLUMN description TEXT;
