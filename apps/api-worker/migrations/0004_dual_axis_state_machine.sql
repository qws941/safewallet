-- Migration: Dual-axis state machine (ReviewStatus + ActionStatus consolidation)
-- Purpose: Rename RECEIVED→PENDING, add URGENT; Update ActionStatus enum values
-- Date: 2026-02-11

-- SQLite doesn't support ALTER COLUMN, so we need to recreate the posts table
-- First, create new posts table with updated schema
CREATE TABLE posts_new (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  site_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('HAZARD', 'UNSAFE_BEHAVIOR', 'INCONVENIENCE', 'SUGGESTION', 'BEST_PRACTICE')),
  hazard_type TEXT,
  risk_level TEXT CHECK(risk_level IN ('HIGH', 'MEDIUM', 'LOW')),
  location_floor TEXT,
  location_zone TEXT,
  location_detail TEXT,
  content TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'WORKER_PUBLIC' CHECK(visibility IN ('WORKER_PUBLIC', 'ADMIN_ONLY')),
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  review_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(review_status IN ('PENDING', 'IN_REVIEW', 'NEED_INFO', 'APPROVED', 'REJECTED', 'URGENT')),
  action_status TEXT NOT NULL DEFAULT 'NONE' CHECK(action_status IN ('NONE', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'OVERDUE')),
  is_urgent INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- Drop old indexes if they exist
DROP INDEX IF EXISTS posts_site_review_status_idx;
DROP INDEX IF EXISTS posts_site_created_at_idx;
DROP INDEX IF EXISTS posts_user_created_at_idx;

-- Create indexes for posts_new
CREATE INDEX posts_site_review_status_idx ON posts_new(site_id, review_status);
CREATE INDEX posts_site_created_at_idx ON posts_new(site_id, created_at);
CREATE INDEX posts_user_created_at_idx ON posts_new(user_id, created_at);

-- Copy data with value mapping
INSERT INTO posts_new 
SELECT 
  id, 
  user_id, 
  site_id, 
  category,
  hazard_type,
  risk_level,
  location_floor,
  location_zone,
  location_detail,
  content,
  visibility,
  is_anonymous,
  CASE 
    WHEN review_status = 'RECEIVED' THEN 'PENDING'
    ELSE review_status 
  END as review_status,
  -- Map old actionStatus values to new ones
  CASE 
    WHEN action_status = 'NONE' THEN 'NONE'
    WHEN action_status = 'REQUIRED' THEN 'ASSIGNED'
    WHEN action_status = 'ASSIGNED' THEN 'ASSIGNED'
    WHEN action_status = 'IN_PROGRESS' THEN 'IN_PROGRESS'
    WHEN action_status = 'DONE' THEN 'COMPLETED'
    WHEN action_status = 'REOPENED' THEN 'OVERDUE'
    ELSE 'NONE'
  END as action_status,
  is_urgent,
  created_at,
  updated_at
FROM posts;

-- Drop old table and rename
DROP TABLE posts;
ALTER TABLE posts_new RENAME TO posts;

-- Recreate actions table with consolidated actionStatusEnum
CREATE TABLE actions_new (
  id TEXT PRIMARY KEY NOT NULL,
  post_id TEXT NOT NULL,
  assignee_type TEXT NOT NULL,
  assignee_id TEXT,
  due_date INTEGER,
  action_status TEXT NOT NULL DEFAULT 'NONE' CHECK(action_status IN ('NONE', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'OVERDUE')),
  completion_note TEXT,
  completed_at INTEGER,
  created_at INTEGER,
  FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY(assignee_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Drop old indexes if they exist
DROP INDEX IF EXISTS actions_post_idx;

-- Create index for actions_new
CREATE INDEX actions_post_idx ON actions_new(post_id);

-- Copy data with value mapping
INSERT INTO actions_new
SELECT 
  id,
  post_id,
  assignee_type,
  assignee_id,
  due_date,
  CASE 
    WHEN action_status = 'OPEN' THEN 'NONE'
    WHEN action_status = 'IN_PROGRESS' THEN 'IN_PROGRESS'
    WHEN action_status = 'DONE' THEN 'COMPLETED'
    ELSE 'NONE'
  END as action_status,
  completion_note,
  completed_at,
  created_at
FROM actions;

-- Drop old table and rename
DROP TABLE actions;
ALTER TABLE actions_new RENAME TO actions;
