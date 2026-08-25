PRAGMA foreign_keys = ON;

ALTER TABLE sessions
ADD COLUMN recent_auth_at INTEGER NOT NULL DEFAULT 0;

CREATE TABLE backup_jobs (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  requested_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  backup_type TEXT NOT NULL CHECK (backup_type IN ('data', 'full')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'preparing', 'succeeded', 'failed', 'expired')),
  format_version TEXT NOT NULL CHECK (format_version = '1.0'),
  include_requester_drafts INTEGER NOT NULL DEFAULT 0 CHECK (include_requester_drafts IN (0, 1)),
  estimated_bytes INTEGER,
  planned_media_files INTEGER NOT NULL DEFAULT 0 CHECK (planned_media_files >= 0),
  exported_media_files INTEGER NOT NULL DEFAULT 0 CHECK (exported_media_files >= 0),
  missing_media_files INTEGER NOT NULL DEFAULT 0 CHECK (missing_media_files >= 0),
  archive_bytes INTEGER CHECK (archive_bytes IS NULL OR archive_bytes >= 0),
  error_code TEXT CHECK (error_code IS NULL OR length(error_code) <= 80),
  snapshot_started_at INTEGER,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  expires_at INTEGER NOT NULL,
  downloaded_at INTEGER,
  CHECK (completed_at IS NULL OR status IN ('succeeded', 'failed', 'expired'))
);

CREATE INDEX idx_backup_jobs_relationship_created
  ON backup_jobs(relationship_id, created_at DESC);
CREATE INDEX idx_backup_jobs_requester_created
  ON backup_jobs(requested_by_user_id, created_at DESC);
CREATE INDEX idx_backup_jobs_status_expires
  ON backup_jobs(status, expires_at);

CREATE UNIQUE INDEX idx_backup_jobs_one_active_full
  ON backup_jobs(relationship_id)
  WHERE backup_type = 'full' AND status IN ('queued', 'preparing');
