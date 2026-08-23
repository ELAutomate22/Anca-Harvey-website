PRAGMA foreign_keys = ON;

CREATE TABLE movie_watchlist (
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  tmdb_movie_id INTEGER NOT NULL CHECK (tmdb_movie_id > 0),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 250),
  poster_path TEXT CHECK (poster_path IS NULL OR length(poster_path) <= 250),
  release_year INTEGER CHECK (release_year IS NULL OR release_year BETWEEN 1870 AND 2200),
  added_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (relationship_id, tmdb_movie_id)
);

CREATE INDEX idx_movie_watchlist_relationship_created
  ON movie_watchlist(relationship_id, created_at DESC);

CREATE TABLE movie_history (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  tmdb_movie_id INTEGER NOT NULL CHECK (tmdb_movie_id > 0),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 250),
  poster_path TEXT CHECK (poster_path IS NULL OR length(poster_path) <= 250),
  release_year INTEGER CHECK (release_year IS NULL OR release_year BETWEEN 1870 AND 2200),
  watched_on TEXT NOT NULL CHECK (watched_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 5000),
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_movie_history_relationship_watched
  ON movie_history(relationship_id, watched_on DESC, created_at DESC);
CREATE INDEX idx_movie_history_relationship_movie
  ON movie_history(relationship_id, tmdb_movie_id, watched_on DESC);

CREATE TABLE movie_history_ratings (
  history_id TEXT NOT NULL REFERENCES movie_history(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  rating_half_steps INTEGER NOT NULL CHECK (rating_half_steps BETWEEN 1 AND 10),
  PRIMARY KEY (history_id, user_id)
);

CREATE INDEX idx_movie_ratings_user ON movie_history_ratings(user_id);

CREATE TABLE games (
  id TEXT PRIMARY KEY,
  relationship_id TEXT REFERENCES relationships(id) ON DELETE CASCADE,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 150),
  category TEXT NOT NULL CHECK (length(category) BETWEEN 1 AND 80),
  player_count TEXT NOT NULL DEFAULT '2 players' CHECK (length(player_count) <= 80),
  duration TEXT NOT NULL DEFAULT '' CHECK (length(duration) <= 80),
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 5000),
  built_in INTEGER NOT NULL DEFAULT 0 CHECK (built_in IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (built_in = 1 AND relationship_id IS NULL AND created_by_user_id IS NULL)
    OR (built_in = 0 AND relationship_id IS NOT NULL AND created_by_user_id IS NOT NULL)
  )
);

CREATE INDEX idx_games_relationship_category ON games(relationship_id, category, name);
CREATE INDEX idx_games_built_in_category ON games(built_in, category, name);

CREATE TABLE game_history (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
  played_on TEXT NOT NULL CHECK (played_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  outcome TEXT NOT NULL CHECK (outcome IN ('partner_win', 'draw', 'cooperative_win', 'no_winner')),
  winner_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  rating_half_steps INTEGER NOT NULL CHECK (rating_half_steps BETWEEN 1 AND 10),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 5000),
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (outcome = 'partner_win' AND winner_user_id IS NOT NULL)
    OR (outcome <> 'partner_win' AND winner_user_id IS NULL)
  )
);

CREATE INDEX idx_game_history_relationship_played
  ON game_history(relationship_id, played_on DESC, created_at DESC);
CREATE INDEX idx_game_history_relationship_game
  ON game_history(relationship_id, game_id, played_on DESC);

CREATE TABLE songs (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 250),
  artist TEXT NOT NULL CHECK (length(artist) BETWEEN 1 AND 250),
  spotify_url TEXT CHECK (spotify_url IS NULL OR length(spotify_url) <= 1000),
  youtube_url TEXT CHECK (youtube_url IS NULL OR length(youtube_url) <= 1000),
  why_it_matters TEXT NOT NULL DEFAULT '' CHECK (length(why_it_matters) <= 5000),
  added_on TEXT NOT NULL CHECK (added_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  associated_memory_id TEXT REFERENCES memories(id) ON DELETE SET NULL,
  artwork_media_id TEXT REFERENCES memory_media(id) ON DELETE SET NULL,
  is_our_song INTEGER NOT NULL DEFAULT 0 CHECK (is_our_song IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_songs_one_our_song
  ON songs(relationship_id) WHERE is_our_song = 1;
CREATE INDEX idx_songs_relationship_added
  ON songs(relationship_id, added_on DESC, created_at DESC);
CREATE INDEX idx_songs_associated_memory ON songs(associated_memory_id);

INSERT INTO games (
  id, relationship_id, created_by_user_id, name, category, player_count, duration, notes, built_in, created_at, updated_at
) VALUES
  ('builtin-uno', NULL, NULL, 'UNO', 'Cards', '2+ players', '15–30 min', 'Fast, familiar, and delightfully competitive.', 1, 0, 0),
  ('builtin-monopoly-deal', NULL, NULL, 'Monopoly Deal', 'Cards', '2–5 players', '15–25 min', 'A quick property-card rivalry.', 1, 0, 0),
  ('builtin-scrabble', NULL, NULL, 'Scrabble', 'Board', '2 players', '45–90 min', 'Words, strategy, and questionable dictionaries.', 1, 0, 0),
  ('builtin-chess', NULL, NULL, 'Chess', 'Board', '2 players', '20–60 min', 'A quiet duel with no luck required.', 1, 0, 0),
  ('builtin-checkers', NULL, NULL, 'Checkers', 'Board', '2 players', '15–30 min', 'Simple to begin, satisfying to master.', 1, 0, 0),
  ('builtin-jenga', NULL, NULL, 'Jenga', 'Party', '2+ players', '15–30 min', 'Steady hands and a steadily worse tower.', 1, 0, 0),
  ('builtin-dobble', NULL, NULL, 'Dobble', 'Quick', '2+ players', '10–20 min', 'A tiny, frantic pattern hunt.', 1, 0, 0),
  ('builtin-cards', NULL, NULL, 'A Deck of Cards', 'Cards', '2+ players', 'Flexible', 'Pick a favourite game from a simple deck.', 1, 0, 0),
  ('builtin-heads-up', NULL, NULL, 'Heads-Up-style', 'Party', '2+ players', '15–30 min', 'Guess the prompt before time runs out.', 1, 0, 0),
  ('builtin-charades', NULL, NULL, 'Charades', 'Party', '2+ players', '20–45 min', 'No words, plenty of committed acting.', 1, 0, 0),
  ('builtin-20-questions', NULL, NULL, '20 Questions', 'Conversation', '2 players', '10–20 min', 'Ask carefully and narrow down the answer.', 1, 0, 0),
  ('builtin-would-you-rather', NULL, NULL, 'Would You Rather', 'Conversation', '2 players', '15–30 min', 'Small choices that become long conversations.', 1, 0, 0),
  ('builtin-it-takes-two', NULL, NULL, 'It Takes Two', 'Video game', '2 players', 'Session', 'A story-led cooperative adventure.', 1, 0, 0),
  ('builtin-overcooked', NULL, NULL, 'Overcooked', 'Video game', '2+ players', 'Session', 'Cooperative cooking under cheerful pressure.', 1, 0, 0),
  ('builtin-mario-kart', NULL, NULL, 'Mario Kart', 'Video game', '2+ players', '15–60 min', 'Bright racing and tactical blue shells.', 1, 0, 0),
  ('builtin-minecraft', NULL, NULL, 'Minecraft', 'Video game', '2+ players', 'Open-ended', 'Build something together or wander for a while.', 1, 0, 0);
