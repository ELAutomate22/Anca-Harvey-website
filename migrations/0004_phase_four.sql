PRAGMA foreign_keys = ON;

CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  relationship_id TEXT REFERENCES relationships(id) ON DELETE CASCADE,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 150),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  category TEXT NOT NULL CHECK (category IN (
    'food', 'adventure', 'relaxing', 'creative', 'outdoors', 'at_home',
    'romantic', 'competitive', 'spontaneous', 'culture', 'fitness', 'travel',
    'entertainment', 'exploring', 'seasonal', 'photography', 'shopping',
    'learning', 'other'
  )),
  location_type TEXT NOT NULL CHECK (location_type IN ('indoor', 'outdoor', 'either', 'home')),
  budget_level TEXT NOT NULL CHECK (budget_level IN ('free', 'one', 'two', 'three')),
  energy_level TEXT NOT NULL CHECK (energy_level IN ('lazy', 'normal', 'adventurous')),
  duration_category TEXT NOT NULL CHECK (duration_category IN (
    'under_1_hour', 'one_to_three_hours', 'half_day', 'whole_day'
  )),
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 5000),
  is_builtin INTEGER NOT NULL DEFAULT 0 CHECK (is_builtin IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (is_builtin = 1 AND relationship_id IS NULL AND created_by_user_id IS NULL)
    OR (is_builtin = 0 AND relationship_id IS NOT NULL AND created_by_user_id IS NOT NULL)
  )
);

CREATE INDEX idx_activities_relationship_category
  ON activities(relationship_id, is_active, category, name);
CREATE INDEX idx_activities_builtin_filters
  ON activities(is_builtin, is_active, location_type, budget_level, energy_level, duration_category);

CREATE TABLE activity_exclusions (
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (relationship_id, activity_id)
);

CREATE TABLE saved_activities (
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  saved_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (relationship_id, activity_id)
);

CREATE INDEX idx_saved_activities_relationship_created
  ON saved_activities(relationship_id, created_at DESC);

CREATE TABLE activity_suggestions (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  accepted INTEGER NOT NULL DEFAULT 0 CHECK (accepted IN (0, 1)),
  suggested_at INTEGER NOT NULL
);

CREATE INDEX idx_activity_suggestions_recent
  ON activity_suggestions(relationship_id, suggested_at DESC);

CREATE TABLE planned_activities (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE RESTRICT,
  planned_date TEXT NOT NULL CHECK (planned_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  planned_time TEXT CHECK (planned_time IS NULL OR planned_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 5000),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'cancelled')),
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_planned_activities_relationship_date
  ON planned_activities(relationship_id, status, planned_date, planned_time);

CREATE TABLE activity_history (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE RESTRICT,
  planned_activity_id TEXT UNIQUE REFERENCES planned_activities(id) ON DELETE SET NULL,
  completed_date TEXT NOT NULL CHECK (completed_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  rating_half_steps INTEGER CHECK (rating_half_steps IS NULL OR rating_half_steps BETWEEN 1 AND 10),
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 5000),
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  linked_memory_id TEXT REFERENCES memories(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_activity_history_relationship_completed
  ON activity_history(relationship_id, completed_date DESC, created_at DESC);
CREATE INDEX idx_activity_history_relationship_activity
  ON activity_history(relationship_id, activity_id, completed_date DESC);

CREATE TABLE bucket_list_items (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  completed_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 5000),
  category TEXT NOT NULL CHECK (category IN (
    'travel', 'food', 'experiences', 'places', 'adventure', 'romantic',
    'small_things', 'big_dreams', 'learning', 'seasonal', 'life_goals', 'custom'
  )),
  status TEXT NOT NULL DEFAULT 'dreaming' CHECK (status IN ('dreaming', 'planning', 'booked', 'completed')),
  target_date TEXT CHECK (target_date IS NULL OR target_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  location TEXT NOT NULL DEFAULT '' CHECK (length(location) <= 250),
  priority TEXT CHECK (priority IS NULL OR priority IN ('someday', 'would_love_to', 'must_do')),
  completed_at TEXT CHECK (completed_at IS NULL OR completed_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  completion_rating_half_steps INTEGER CHECK (
    completion_rating_half_steps IS NULL OR completion_rating_half_steps BETWEEN 1 AND 10
  ),
  completion_note TEXT NOT NULL DEFAULT '' CHECK (length(completion_note) <= 5000),
  linked_memory_id TEXT REFERENCES memories(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (status = 'completed' AND completed_at IS NOT NULL AND completed_by_user_id IS NOT NULL)
    OR (status <> 'completed' AND completed_at IS NULL AND completed_by_user_id IS NULL
      AND completion_rating_half_steps IS NULL AND completion_note = '' AND linked_memory_id IS NULL)
  )
);

CREATE INDEX idx_bucket_list_relationship_status
  ON bucket_list_items(relationship_id, status, updated_at DESC);
CREATE INDEX idx_bucket_list_relationship_target
  ON bucket_list_items(relationship_id, target_date, created_at DESC);

INSERT INTO activities (
  id, relationship_id, created_by_user_id, name, description, category,
  location_type, budget_level, energy_level, duration_category, notes,
  is_builtin, is_active, created_at, updated_at
) VALUES
  ('builtin-picnic-park', NULL, NULL, 'Picnic in a park', 'Pack two favourite things each and find a quiet patch of green.', 'outdoors', 'outdoor', 'one', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-museum', NULL, NULL, 'Visit a museum', 'Choose one room each and show the other the object you would take home.', 'culture', 'indoor', 'one', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-aquarium', NULL, NULL, 'Visit an aquarium', 'Take a slow walk through the exhibits and pick a favourite sea creature.', 'exploring', 'indoor', 'two', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-bake-together', NULL, NULL, 'Bake something together', 'Pick a recipe neither of you has made and share every job.', 'food', 'home', 'one', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-cafe-hopping', NULL, NULL, 'Go cafe hopping', 'Share one drink or small treat in three different cafes.', 'food', 'either', 'two', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-countryside-walk', NULL, NULL, 'Take a countryside walk', 'Choose a gentle route, bring a flask, and leave room for an unplanned stop.', 'outdoors', 'outdoor', 'free', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-bookshop-date', NULL, NULL, 'Have a bookshop date', 'Choose a book for each other and compare the first pages over coffee.', 'culture', 'indoor', 'one', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-photo-challenge', NULL, NULL, 'Try a photography challenge', 'Take ten photographs each around one shared theme, then compare what you noticed.', 'photography', 'either', 'free', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-pottery-painting', NULL, NULL, 'Paint pottery together', 'Choose useful pieces, swap one colour, and make something imperfectly personal.', 'creative', 'indoor', 'two', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-bowling', NULL, NULL, 'Go bowling', 'Play two games and let the winner choose the post-game snack.', 'competitive', 'indoor', 'two', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-mini-golf', NULL, NULL, 'Play mini golf', 'Keep score seriously or invent a ridiculous rule for every hole.', 'competitive', 'either', 'two', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-arcade', NULL, NULL, 'Visit an arcade', 'Set a small token budget and compete for the most gloriously unnecessary prize.', 'entertainment', 'indoor', 'two', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-zoo', NULL, NULL, 'Visit a zoo', 'Wander without rushing and each choose an animal to photograph.', 'exploring', 'outdoor', 'two', 'normal', 'whole_day', '', 1, 1, 0, 0),
  ('builtin-train-trip', NULL, NULL, 'Take a spontaneous train trip', 'Choose a nearby stop you have never explored and arrive with one simple plan.', 'travel', 'either', 'three', 'adventurous', 'whole_day', '', 1, 1, 0, 0),
  ('builtin-thrift-challenge', NULL, NULL, 'Try a thrift-store challenge', 'Set a tiny budget and find the funniest or most thoughtful thing for each other.', 'shopping', 'indoor', 'one', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-new-cuisine', NULL, NULL, 'Cook a cuisine neither has tried', 'Choose one unfamiliar dish, shop together, and learn as you go.', 'food', 'home', 'two', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-first-date', NULL, NULL, 'Recreate your first date', 'Return to the place, meal, or mood that started the story and notice what changed.', 'romantic', 'either', 'two', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-sunset-walk', NULL, NULL, 'Take a sunset walk', 'Choose an open view and time the route so the sky changes on the way back.', 'romantic', 'outdoor', 'free', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-mocktails', NULL, NULL, 'Make cocktails or mocktails', 'Choose a flavour for each other and create a house drink with a proper name.', 'food', 'home', 'one', 'lazy', 'under_1_hour', '', 1, 1, 0, 0),
  ('builtin-ikea-challenge', NULL, NULL, 'Try an IKEA challenge', 'Choose the strangest room setup, a dream kitchen, and one snack to share.', 'shopping', 'indoor', 'one', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-twenty-pound-date', NULL, NULL, 'Plan a twenty-pound date', 'Use one shared budget and make the afternoon feel generous through good choices.', 'spontaneous', 'either', 'one', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-time-capsule', NULL, NULL, 'Create a time capsule', 'Collect a note, a small object, and predictions for a future version of you.', 'creative', 'home', 'one', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-future-letters', NULL, NULL, 'Write letters to your future selves', 'Write privately for twenty minutes, seal the pages, and choose an opening date.', 'romantic', 'home', 'free', 'lazy', 'under_1_hour', '', 1, 1, 0, 0),
  ('builtin-scrapbook-page', NULL, NULL, 'Create a scrapbook page', 'Print or sketch one moment and build a single page around the details you remember.', 'creative', 'home', 'one', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-outfits', NULL, NULL, 'Choose outfits for each other', 'Style one complete outfit each from clothes you already own, then wear them out.', 'shopping', 'home', 'free', 'normal', 'under_1_hour', '', 1, 1, 0, 0),
  ('builtin-phone-free', NULL, NULL, 'Have a phone-free afternoon', 'Put both phones away, choose one neighbourhood, and follow whatever catches your attention.', 'relaxing', 'either', 'free', 'lazy', 'half_day', '', 1, 1, 0, 0),
  ('builtin-cook-off', NULL, NULL, 'Have a friendly cook-off', 'Use the same main ingredient and make two small dishes to taste side by side.', 'competitive', 'home', 'two', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-mystery-date', NULL, NULL, 'Plan a mystery date', 'One person chooses the destination and gives only a dress-code clue.', 'spontaneous', 'either', 'two', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-market', NULL, NULL, 'Go to a market', 'Browse every aisle, choose one ingredient, and turn it into dinner later.', 'exploring', 'either', 'one', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-new-breakfast', NULL, NULL, 'Have breakfast somewhere new', 'Start earlier than usual and order something neither of you normally chooses.', 'food', 'indoor', 'two', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-dessert-place', NULL, NULL, 'Try a new dessert place', 'Share two different desserts and decide which deserves a return visit.', 'food', 'indoor', 'one', 'lazy', 'under_1_hour', '', 1, 1, 0, 0),
  ('builtin-disposable-photos', NULL, NULL, 'Take disposable-camera-style photos', 'Limit yourselves to twelve frames and no retakes for the whole outing.', 'photography', 'either', 'one', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-new-sunset-view', NULL, NULL, 'Find an unfamiliar sunset view', 'Use a map to choose a new west-facing place and arrive before golden hour.', 'exploring', 'outdoor', 'free', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-cycling', NULL, NULL, 'Go cycling together', 'Choose a comfortable traffic-light route with one scenic or snack stop.', 'fitness', 'outdoor', 'free', 'adventurous', 'half_day', '', 1, 1, 0, 0),
  ('builtin-botanical-garden', NULL, NULL, 'Visit a botanical garden', 'Walk slowly, pick a favourite plant, and take one portrait of each other.', 'outdoors', 'either', 'one', 'lazy', 'half_day', '', 1, 1, 0, 0),
  ('builtin-escape-room', NULL, NULL, 'Try an escape room', 'Choose a beginner-friendly room and solve it as a team without taking score.', 'adventure', 'indoor', 'three', 'adventurous', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-castle', NULL, NULL, 'Visit a castle', 'Explore the grounds and choose the room with the best imaginary backstory.', 'culture', 'either', 'two', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-gallery', NULL, NULL, 'Go to an art gallery', 'Each choose one work to explain, even if the explanation is entirely invented.', 'culture', 'indoor', 'free', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-new-recipe', NULL, NULL, 'Try a new recipe', 'Choose something just outside your comfort zone and divide the steps fairly.', 'food', 'home', 'two', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-blanket-fort', NULL, NULL, 'Build a blanket fort', 'Use every spare cushion, add soft lights, and bring dinner inside.', 'at_home', 'home', 'free', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-blind-taste', NULL, NULL, 'Do a blind taste test', 'Choose five snacks or drinks and see who can identify the most.', 'competitive', 'home', 'one', 'lazy', 'under_1_hour', '', 1, 1, 0, 0),
  ('builtin-playlist', NULL, NULL, 'Create a relationship playlist', 'Take turns adding songs for different chapters and explain one surprising choice.', 'creative', 'home', 'free', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-paint-each-other', NULL, NULL, 'Paint each other', 'Set a timer, use simple supplies, and promise to display both portraits for a week.', 'creative', 'home', 'one', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-swimming', NULL, NULL, 'Go swimming', 'Choose a familiar, supervised pool and finish with a slow drink nearby.', 'fitness', 'indoor', 'two', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-puzzle', NULL, NULL, 'Do a puzzle together', 'Pick a modest puzzle, make good drinks, and leave it out until it is finished.', 'at_home', 'home', 'one', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-pizza', NULL, NULL, 'Make homemade pizza', 'Prepare one shared base and divide it into two wildly different halves.', 'food', 'home', 'one', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-ice-skating', NULL, NULL, 'Go ice skating', 'Choose a public seasonal session and take it slowly around the rink.', 'seasonal', 'indoor', 'two', 'adventurous', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-christmas-market', NULL, NULL, 'Visit a Christmas market', 'Share one warm drink, choose a small ornament, and take an evening photograph.', 'seasonal', 'outdoor', 'two', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-fruit-picking', NULL, NULL, 'Go fruit picking', 'Choose an in-season farm, fill one basket, and make something with it at home.', 'seasonal', 'outdoor', 'two', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-scenic-drive', NULL, NULL, 'Take a scenic drive', 'Pick a relaxed route with two safe stopping points and let the passenger choose the music.', 'exploring', 'either', 'two', 'lazy', 'half_day', '', 1, 1, 0, 0),
  ('builtin-nearby-town', NULL, NULL, 'Explore a nearby town', 'Walk the high street, find a local landmark, and try one independent cafe.', 'exploring', 'either', 'two', 'normal', 'whole_day', '', 1, 1, 0, 0),
  ('builtin-no-phone-picnic', NULL, NULL, 'Have a no-phone picnic', 'Pack simple food, leave phones in the bag, and bring one question each.', 'romantic', 'outdoor', 'one', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-new-sport', NULL, NULL, 'Try a new sport', 'Book a beginner-friendly session and agree that laughing counts as progress.', 'fitness', 'either', 'two', 'adventurous', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-comedy-show', NULL, NULL, 'Go to a comedy show', 'Choose a small local show and compare favourite lines on the way home.', 'entertainment', 'indoor', 'three', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-local-attraction', NULL, NULL, 'Visit a local attraction', 'Pick the place nearby that tourists know but you have somehow never visited.', 'exploring', 'either', 'two', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-photo-album', NULL, NULL, 'Make a photo album', 'Choose one season of photographs and turn the best ones into a small printed story.', 'photography', 'home', 'two', 'lazy', 'half_day', '', 1, 1, 0, 0),
  ('builtin-brunch', NULL, NULL, 'Go for brunch', 'Choose somewhere bright, split one sweet dish, and take the long way home.', 'food', 'indoor', 'two', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-afternoon-tea', NULL, NULL, 'Have afternoon tea', 'Dress a little nicer than necessary and share everything in the middle.', 'romantic', 'indoor', 'three', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-hiking', NULL, NULL, 'Go hiking', 'Choose a signed route suited to both of you, check the weather, and bring water.', 'fitness', 'outdoor', 'one', 'adventurous', 'whole_day', '', 1, 1, 0, 0),
  ('builtin-tasting-menu-home', NULL, NULL, 'Create a tasting menu at home', 'Turn several tiny dishes into a playful menu and write the courses on paper.', 'food', 'home', 'two', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-dessert-together', NULL, NULL, 'Make dessert together', 'Choose one nostalgic dessert and one ingredient that makes it yours.', 'food', 'home', 'one', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-tourist-city', NULL, NULL, 'Play tourist in your own city', 'Choose a landmark, take shameless photographs, and buy one postcard.', 'exploring', 'either', 'two', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-garden-centre', NULL, NULL, 'Choose a plant at a garden centre', 'Pick one plant together, give it a name, and find the right place for it at home.', 'shopping', 'indoor', 'one', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-lego', NULL, NULL, 'Build Lego together', 'Choose a small set or use loose bricks to make the same prompt separately.', 'at_home', 'home', 'two', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-vision-board', NULL, NULL, 'Make a relationship vision board', 'Collect words and images for the next year without turning it into a checklist.', 'creative', 'home', 'one', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-geocaching', NULL, NULL, 'Try geocaching', 'Choose a well-reviewed beginner cache in a public place and follow the clues together.', 'adventure', 'outdoor', 'free', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-flea-market', NULL, NULL, 'Go to a flea market', 'Find the most interesting object under a tiny shared budget.', 'shopping', 'either', 'one', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-volunteer', NULL, NULL, 'Volunteer together', 'Choose a reputable local organisation and join a suitable scheduled session.', 'learning', 'either', 'free', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-learn-together', NULL, NULL, 'Learn something together', 'Pick one short tutorial or workshop and help each other through the awkward first attempt.', 'learning', 'either', 'one', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-board-games', NULL, NULL, 'Have a board-game afternoon', 'Choose two quick games and one longer favourite, with snacks between rounds.', 'competitive', 'home', 'one', 'lazy', 'half_day', '', 1, 1, 0, 0),
  ('builtin-memory-box', NULL, NULL, 'Make a memory box', 'Gather tickets, notes, and small keepsakes into one labelled box for this chapter.', 'creative', 'home', 'one', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-charity-outfits', NULL, NULL, 'Do a charity-shop outfit challenge', 'Choose a wearable outfit for each other within a friendly budget.', 'shopping', 'indoor', 'one', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-portraits', NULL, NULL, 'Take portraits of each other', 'Find soft light, take turns directing, and choose one photograph each to keep.', 'photography', 'either', 'free', 'normal', 'under_1_hour', '', 1, 1, 0, 0),
  ('builtin-mini-film', NULL, NULL, 'Create a mini film of your day', 'Capture a handful of quiet clips and edit them into one minute without overthinking it.', 'photography', 'either', 'free', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-pottery-class', NULL, NULL, 'Try a pottery class', 'Book a beginner session and make one small object each.', 'creative', 'indoor', 'three', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-dance-class', NULL, NULL, 'Try a dance class', 'Choose a welcoming beginner class and focus on enjoying the rhythm, not perfection.', 'fitness', 'indoor', 'two', 'adventurous', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-climbing', NULL, NULL, 'Try indoor climbing', 'Book an instructed beginner session at a reputable centre and encourage every attempt.', 'adventure', 'indoor', 'three', 'adventurous', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-kayaking', NULL, NULL, 'Try kayaking', 'Choose a supervised beginner session with suitable equipment and calm conditions.', 'adventure', 'outdoor', 'three', 'adventurous', 'half_day', '', 1, 1, 0, 0),
  ('builtin-farm', NULL, NULL, 'Visit a farm', 'Choose a visitor-friendly farm, walk the grounds, and buy something local if available.', 'outdoors', 'outdoor', 'two', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-best-coffee', NULL, NULL, 'Find the best coffee nearby', 'Choose three independent cafes and share one small drink at each.', 'food', 'either', 'two', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-surprise-lunch', NULL, NULL, 'Make each other a surprise lunch', 'Set the same modest budget and reveal both lunches at the table.', 'food', 'home', 'one', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-half-date', NULL, NULL, 'Each plan half of the date', 'One person plans the first half and the other plans the second, with no spoilers.', 'spontaneous', 'either', 'two', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-home-spa', NULL, NULL, 'Create a home spa evening', 'Put away the phones, warm towels, and choose a calm playlist.', 'relaxing', 'home', 'one', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-breakfast-bed', NULL, NULL, 'Make breakfast in bed', 'Keep it simple, add a handwritten menu, and linger longer than usual.', 'romantic', 'home', 'one', 'lazy', 'under_1_hour', '', 1, 1, 0, 0),
  ('builtin-stargazing', NULL, NULL, 'Go stargazing', 'Choose a safe public viewpoint, check the forecast, and bring warm layers.', 'romantic', 'outdoor', 'free', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-library-challenge', NULL, NULL, 'Try a library challenge', 'Find a cookbook, a travel book, and a novel for each other without speaking.', 'culture', 'indoor', 'free', 'lazy', 'under_1_hour', '', 1, 1, 0, 0),
  ('builtin-indoor-picnic', NULL, NULL, 'Have an indoor picnic', 'Spread a blanket on the floor, make picnic food, and play outdoor sounds quietly.', 'at_home', 'home', 'one', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-origami', NULL, NULL, 'Learn origami together', 'Choose three beginner shapes and leave each other a tiny folded note.', 'learning', 'home', 'free', 'lazy', 'under_1_hour', '', 1, 1, 0, 0),
  ('builtin-poetry-night', NULL, NULL, 'Have a poetry night', 'Read a favourite poem each, then write four imperfect lines about the day.', 'culture', 'home', 'free', 'lazy', 'under_1_hour', '', 1, 1, 0, 0),
  ('builtin-food-hall', NULL, NULL, 'Share a food-hall tasting', 'Choose three small dishes from different places and share everything.', 'food', 'indoor', 'two', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-riverside', NULL, NULL, 'Take a riverside walk', 'Follow a public path, stop for ten quiet minutes, and photograph the reflections.', 'outdoors', 'outdoor', 'free', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-history-trail', NULL, NULL, 'Follow a local history trail', 'Find a self-guided public route and take turns reading the stories aloud.', 'culture', 'outdoor', 'free', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-matinee', NULL, NULL, 'Go to a cinema matinee', 'Choose a film on the day, share the snacks, and discuss it over an early dinner.', 'entertainment', 'indoor', 'two', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-live-music', NULL, NULL, 'See live music at a small venue', 'Choose a relaxed local performance and arrive early enough to settle in.', 'entertainment', 'indoor', 'three', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-herb-garden', NULL, NULL, 'Plant a small herb garden', 'Choose two useful herbs and make simple labels together.', 'at_home', 'home', 'one', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-yoga', NULL, NULL, 'Try a gentle yoga session', 'Choose a beginner video or class and keep the pace comfortable for both of you.', 'fitness', 'home', 'free', 'lazy', 'under_1_hour', '', 1, 1, 0, 0),
  ('builtin-treasure-hunt', NULL, NULL, 'Make a tiny treasure hunt', 'Hide three clues each around the home and finish with a favourite snack.', 'competitive', 'home', 'one', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-seasonal-craft', NULL, NULL, 'Make a seasonal decoration', 'Use simple supplies to create one wreath, garland, or table decoration together.', 'seasonal', 'home', 'one', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-sign-language', NULL, NULL, 'Learn a few sign-language phrases', 'Use a reputable introductory resource and practise a short everyday exchange.', 'learning', 'home', 'free', 'lazy', 'under_1_hour', '', 1, 1, 0, 0),
  ('builtin-shared-dream-list', NULL, NULL, 'Start a shared dream list', 'Write ten things you would love to experience and choose one small first step.', 'romantic', 'home', 'free', 'lazy', 'under_1_hour', '', 1, 1, 0, 0),
  ('builtin-documentary', NULL, NULL, 'Watch a documentary and discuss it', 'Choose a subject neither knows well, make notes, and compare what surprised you.', 'learning', 'home', 'free', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0);
