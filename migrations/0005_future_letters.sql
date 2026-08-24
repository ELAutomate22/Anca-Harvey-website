PRAGMA foreign_keys = ON;

-- Future export code must treat this table as a protected-content boundary:
-- draft and sealed typed_content is never exportable; opened content may be exported later.
CREATE TABLE future_letters (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recipient_type TEXT CHECK (recipient_type IS NULL OR recipient_type IN ('user', 'both')),
  recipient_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL DEFAULT '' CHECK (length(title) <= 200),
  letter_type TEXT NOT NULL CHECK (letter_type IN ('typed', 'uploaded')),
  typed_content TEXT CHECK (typed_content IS NULL OR length(typed_content) <= 100000),
  teaser TEXT NOT NULL DEFAULT '' CHECK (length(teaser) <= 500),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sealed', 'opened')),
  unlock_at INTEGER,
  sealed_at INTEGER,
  opened_at INTEGER,
  first_opened_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (id, relationship_id),
  CHECK (
    (recipient_type IS NULL AND recipient_user_id IS NULL)
    OR (recipient_type = 'both' AND recipient_user_id IS NULL)
    OR (recipient_type = 'user' AND recipient_user_id IS NOT NULL)
  ),
  CHECK (letter_type = 'typed' OR typed_content IS NULL),
  CHECK (
    status = 'draft'
    OR (
      length(title) BETWEEN 1 AND 200
      AND recipient_type IS NOT NULL
      AND unlock_at IS NOT NULL
      AND sealed_at IS NOT NULL
      AND (letter_type = 'uploaded' OR length(COALESCE(typed_content, '')) > 0)
    )
  ),
  CHECK (
    (status = 'opened' AND opened_at IS NOT NULL AND first_opened_by_user_id IS NOT NULL)
    OR (status <> 'opened' AND opened_at IS NULL AND first_opened_by_user_id IS NULL)
  )
);

CREATE INDEX idx_future_letters_relationship_status_unlock
  ON future_letters(relationship_id, status, unlock_at, updated_at DESC);
CREATE INDEX idx_future_letters_creator_drafts
  ON future_letters(created_by_user_id, status, updated_at DESC);
CREATE INDEX idx_future_letters_recipient_ready
  ON future_letters(recipient_user_id, status, unlock_at);
CREATE INDEX idx_future_letters_opened_archive
  ON future_letters(relationship_id, opened_at DESC)
  WHERE status = 'opened';

CREATE TABLE future_letter_media (
  id TEXT PRIMARY KEY,
  future_letter_id TEXT NOT NULL,
  relationship_id TEXT NOT NULL,
  uploaded_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  media_role TEXT NOT NULL CHECK (media_role IN ('page', 'cover')),
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type = 'image'),
  r2_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL CHECK (length(original_filename) BETWEEN 1 AND 255),
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/avif')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 20971520),
  width INTEGER CHECK (width IS NULL OR width > 0),
  height INTEGER CHECK (height IS NULL OR height > 0),
  alt_text TEXT NOT NULL DEFAULT '' CHECK (length(alt_text) <= 500),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (future_letter_id, relationship_id)
    REFERENCES future_letters(id, relationship_id) ON DELETE CASCADE
);

CREATE INDEX idx_future_letter_media_letter_order
  ON future_letter_media(future_letter_id, media_role, sort_order, created_at);
CREATE UNIQUE INDEX idx_future_letter_one_cover
  ON future_letter_media(future_letter_id)
  WHERE media_role = 'cover';
