-- Migration: Add disputes table for ticket/dispute system
CREATE TABLE IF NOT EXISTS disputes (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('REVIEW_APPEAL', 'POINT_DISPUTE', 'ATTENDANCE_DISPUTE', 'OTHER')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED')),
  ref_review_id TEXT REFERENCES reviews(id) ON DELETE SET NULL,
  ref_points_ledger_id TEXT REFERENCES points_ledger(id) ON DELETE SET NULL,
  ref_attendance_id TEXT REFERENCES attendances(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  resolved_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolution_note TEXT,
  resolved_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS disputes_site_idx ON disputes(site_id);
CREATE INDEX IF NOT EXISTS disputes_user_idx ON disputes(user_id);
CREATE INDEX IF NOT EXISTS disputes_status_idx ON disputes(status);
