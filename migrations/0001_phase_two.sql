PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TRIGGER users_limit_two
BEFORE INSERT ON users
WHEN (SELECT COUNT(*) FROM users) >= 2
  AND NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'exactly two user accounts are supported');
END;

CREATE TABLE relationships (
  id TEXT PRIMARY KEY CHECK (id = 'primary'),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  start_date TEXT NOT NULL CHECK (start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  timezone TEXT NOT NULL DEFAULT 'Europe/London' CHECK (length(timezone) BETWEEN 1 AND 80),
  partner_1_user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  partner_2_user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (partner_1_user_id <> partner_2_user_id)
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  ip_hash TEXT,
  user_agent_hash TEXT
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE login_attempts (
  key_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at INTEGER NOT NULL,
  locked_until INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_login_attempts_updated_at ON login_attempts(updated_at);

CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  caption TEXT NOT NULL DEFAULT '' CHECK (length(caption) <= 2000),
  memory_date TEXT NOT NULL CHECK (memory_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  category TEXT NOT NULL CHECK (length(category) BETWEEN 1 AND 60),
  favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_memories_relationship_date ON memories(relationship_id, memory_date DESC, id DESC);
CREATE INDEX idx_memories_relationship_favorite ON memories(relationship_id, favorite, memory_date DESC);

CREATE TABLE memory_media (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL UNIQUE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  width INTEGER CHECK (width IS NULL OR width > 0),
  height INTEGER CHECK (height IS NULL OR height > 0),
  duration_seconds REAL CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  alt_text TEXT NOT NULL DEFAULT '' CHECK (length(alt_text) <= 500),
  original_filename TEXT NOT NULL CHECK (length(original_filename) BETWEEN 1 AND 255),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_memory_media_memory_order ON memory_media(memory_id, sort_order, created_at);

CREATE TABLE timeline_entries (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  event_date TEXT NOT NULL CHECK (event_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  eyebrow TEXT NOT NULL DEFAULT 'Our note' CHECK (length(eyebrow) BETWEEN 1 AND 80),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_timeline_relationship_date ON timeline_entries(relationship_id, event_date, id);

CREATE TABLE idempotency_keys (
  key_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_idempotency_expires_at ON idempotency_keys(expires_at);
