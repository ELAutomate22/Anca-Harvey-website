ALTER TABLE memories
ADD COLUMN location TEXT NOT NULL DEFAULT '' CHECK (length(location) <= 250);
