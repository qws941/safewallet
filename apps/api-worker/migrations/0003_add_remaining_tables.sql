-- Migration: Add remaining requirement tables
-- QR Code History, Device Registrations, Point Policies, Push Subscriptions

-- QR Code History - Track previous join codes for invalidation
CREATE TABLE IF NOT EXISTS join_code_history (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  join_code TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_by_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invalidated_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS join_code_history_site_idx ON join_code_history(site_id);
CREATE INDEX IF NOT EXISTS join_code_history_code_idx ON join_code_history(join_code);

-- Device Registrations - Track device IDs for fraud prevention
CREATE TABLE IF NOT EXISTS device_registrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_info TEXT,
  first_seen_at INTEGER DEFAULT (unixepoch() * 1000),
  last_seen_at INTEGER DEFAULT (unixepoch() * 1000),
  is_trusted INTEGER NOT NULL DEFAULT 1,
  is_banned INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS device_registrations_device_idx ON device_registrations(device_id);
CREATE INDEX IF NOT EXISTS device_registrations_user_idx ON device_registrations(user_id);

-- Point Policies - Configurable point rules per site
CREATE TABLE IF NOT EXISTS point_policies (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  reason_code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  default_amount INTEGER NOT NULL,
  min_amount INTEGER,
  max_amount INTEGER,
  daily_limit INTEGER,
  monthly_limit INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  updated_at INTEGER DEFAULT (unixepoch() * 1000),
  UNIQUE(site_id, reason_code)
);

CREATE INDEX IF NOT EXISTS point_policies_site_idx ON point_policies(site_id);

-- Push Subscriptions - Web Push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  last_used_at INTEGER
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions(user_id);
