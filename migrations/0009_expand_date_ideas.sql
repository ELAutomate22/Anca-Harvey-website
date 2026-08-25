PRAGMA foreign_keys = ON;

-- Additive starter catalogue expansion. IDs are stable so this migration is safe to
-- replay in local/test setup without duplicating an idea.
INSERT OR IGNORE INTO activities (
  id, relationship_id, created_by_user_id, name, description, category,
  location_type, budget_level, energy_level, duration_category, notes,
  is_builtin, is_active, created_at, updated_at
) VALUES
  ('builtin-dumpling-trail', NULL, NULL, 'Try a dumpling tasting trail', 'Choose two or three nearby places, share one small plate at each, and compare favourites.', 'food', 'indoor', 'two', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-childhood-recipes', NULL, NULL, 'Swap childhood recipes', 'Each choose a dish from childhood, cook both together, and tell the story behind them.', 'food', 'home', 'two', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-street-food-picnic', NULL, NULL, 'Build a street-food picnic', 'Collect two savoury bites and one sweet treat, then find a pleasant place to share them.', 'food', 'either', 'two', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-cheese-fruit-tasting', NULL, NULL, 'Make a cheese and fruit tasting', 'Choose three small pairings, label them, and score the combinations without taking it seriously.', 'food', 'home', 'two', 'lazy', 'under_1_hour', '', 1, 1, 0, 0),

  ('builtin-treetop-course', NULL, NULL, 'Try a treetop adventure course', 'Book a reputable course at a comfortable level and encourage each other through every obstacle.', 'adventure', 'outdoor', 'three', 'adventurous', 'half_day', '', 1, 1, 0, 0),
  ('builtin-paddleboard-session', NULL, NULL, 'Take a beginner paddleboard session', 'Choose a supervised lesson in calm water with all safety equipment provided.', 'adventure', 'outdoor', 'three', 'adventurous', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-horse-riding', NULL, NULL, 'Go on a supervised horse ride', 'Book a beginner-friendly guided ride and enjoy the landscape at an easy pace.', 'adventure', 'outdoor', 'three', 'adventurous', 'half_day', '', 1, 1, 0, 0),
  ('builtin-guided-night-walk', NULL, NULL, 'Join a guided night-time nature walk', 'Find a reputable public event, bring warm layers, and listen for wildlife after dark.', 'adventure', 'outdoor', 'two', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),

  ('builtin-reading-cafe', NULL, NULL, 'Have a slow reading-cafe date', 'Bring a book each, read quietly for half an hour, then share the best passage in your own words.', 'relaxing', 'indoor', 'one', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-massage-exchange', NULL, NULL, 'Try a home massage exchange', 'Set a short timer each, use simple hand or shoulder massage guidance, and keep it comfortable.', 'relaxing', 'home', 'one', 'lazy', 'under_1_hour', '', 1, 1, 0, 0),
  ('builtin-sound-bath', NULL, NULL, 'Attend a sound-bath session', 'Choose a welcoming local class, settle in together, and leave the rest of the evening unplanned.', 'relaxing', 'indoor', 'two', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-digital-sunset', NULL, NULL, 'Have a digital-sunset evening', 'Switch off every screen at sunset, light the room softly, and spend the evening offline.', 'relaxing', 'home', 'free', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),

  ('builtin-candle-workshop', NULL, NULL, 'Make candles together', 'Join a workshop or use a beginner kit to choose scents and pour one candle each.', 'creative', 'either', 'two', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-flower-arranging', NULL, NULL, 'Try flower arranging', 'Choose seasonal stems, make one arrangement together, and find the perfect place for it.', 'creative', 'home', 'two', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-collage-portraits', NULL, NULL, 'Make collage portraits of each other', 'Use old magazines and paper scraps to create affectionate, slightly ridiculous portraits.', 'creative', 'home', 'one', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-shared-short-story', NULL, NULL, 'Write a short story together', 'Alternate one paragraph at a time and agree not to plan the ending in advance.', 'creative', 'home', 'free', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),

  ('builtin-wildflower-walk', NULL, NULL, 'Take a wildflower walk', 'Choose a public trail, identify what you can without picking anything, and photograph one favourite.', 'outdoors', 'outdoor', 'free', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-sunrise-breakfast', NULL, NULL, 'Have breakfast outdoors at sunrise', 'Pack something warm, choose a safe open view, and arrive before the first light.', 'outdoors', 'outdoor', 'one', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-beachcombing', NULL, NULL, 'Go beachcombing', 'Walk a safe stretch of shore, notice unusual shapes and colours, and leave nature where it belongs.', 'outdoors', 'outdoor', 'free', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-birdwatch-reserve', NULL, NULL, 'Visit a nature reserve for birdwatching', 'Bring or borrow binoculars, follow marked paths, and keep a tiny list of what you spot.', 'outdoors', 'outdoor', 'one', 'normal', 'half_day', '', 1, 1, 0, 0),

  ('builtin-living-room-restaurant', NULL, NULL, 'Turn the living room into a restaurant', 'Create a handwritten menu, dress the table, and take turns being host for one course.', 'at_home', 'home', 'two', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-themed-cinema-night', NULL, NULL, 'Create a themed cinema night', 'Match a film with snacks, lighting, and one tiny detail inspired by its setting.', 'at_home', 'home', 'one', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-home-cafe', NULL, NULL, 'Open a home cafe for the morning', 'Make a short drinks menu, add music, and serve breakfast as if it were your favourite corner cafe.', 'at_home', 'home', 'one', 'lazy', 'under_1_hour', '', 1, 1, 0, 0),
  ('builtin-two-person-quiz', NULL, NULL, 'Host a two-person quiz show', 'Write five questions each across silly categories and create a prize from something already at home.', 'at_home', 'home', 'free', 'lazy', 'under_1_hour', '', 1, 1, 0, 0),

  ('builtin-dress-up-dinner', NULL, NULL, 'Dress up for dinner at home', 'Wear something special, set the table properly, and keep both phones in another room.', 'romantic', 'home', 'two', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-relationship-interview', NULL, NULL, 'Interview each other about your story', 'Prepare thoughtful questions about the beginning, the present, and what you hope to remember.', 'romantic', 'home', 'free', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-love-map-walk', NULL, NULL, 'Take a love-map walk', 'Visit three nearby places that mean something to you and share one memory at each stop.', 'romantic', 'outdoor', 'free', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-memory-menu', NULL, NULL, 'Cook a menu from shared memories', 'Choose a starter, main, or dessert connected to different moments in your relationship.', 'romantic', 'home', 'two', 'normal', 'half_day', '', 1, 1, 0, 0),

  ('builtin-pub-quiz', NULL, NULL, 'Join a pub quiz', 'Pick a friendly local quiz, choose a team name together, and celebrate every lucky guess.', 'competitive', 'indoor', 'two', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-darts-match', NULL, NULL, 'Play a darts match', 'Find a safe venue, play a short format, and let the winner choose the shared snack.', 'competitive', 'indoor', 'two', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-table-tennis', NULL, NULL, 'Play table tennis', 'Book a table, warm up without scoring, then play the best of five light-hearted games.', 'competitive', 'indoor', 'two', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-scavenger-bingo', NULL, NULL, 'Create neighbourhood scavenger bingo', 'Write a shared grid of things to spot and see who completes a line first.', 'competitive', 'outdoor', 'free', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),

  ('builtin-coin-flip-walk', NULL, NULL, 'Take a coin-flip walk', 'At each safe junction, flip a coin for left or right and stop when you find somewhere inviting.', 'spontaneous', 'outdoor', 'free', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-last-minute-tickets', NULL, NULL, 'Book last-minute event tickets', 'Check what is happening nearby today, set a firm budget, and choose the most interesting option.', 'spontaneous', 'either', 'two', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-mystery-envelope', NULL, NULL, 'Open a mystery-date envelope', 'Each prepare one simple sealed date idea, shuffle them, and open one without negotiating.', 'spontaneous', 'either', 'one', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-three-stop-roulette', NULL, NULL, 'Plan a three-stop date roulette', 'Choose food, an activity, and dessert from three short lists using a random number.', 'spontaneous', 'either', 'two', 'normal', 'half_day', '', 1, 1, 0, 0),

  ('builtin-theatre-matinee', NULL, NULL, 'See a theatre matinee', 'Choose a play or musical neither of you knows well and discuss it over an early meal.', 'culture', 'indoor', 'three', 'lazy', 'half_day', '', 1, 1, 0, 0),
  ('builtin-author-talk', NULL, NULL, 'Attend an author talk', 'Find a library or bookshop event and each write down one idea worth discussing afterwards.', 'culture', 'indoor', 'one', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-architecture-walk', NULL, NULL, 'Take an architecture walk', 'Choose one neighbourhood and look up the story behind three buildings that catch your eye.', 'culture', 'outdoor', 'free', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-sculpture-trail', NULL, NULL, 'Follow a sculpture trail', 'Find a public art route, choose a favourite work each, and invent a title for one sculpture.', 'culture', 'outdoor', 'free', 'normal', 'half_day', '', 1, 1, 0, 0),

  ('builtin-badminton', NULL, NULL, 'Play badminton together', 'Book a court, rally first, and keep the scoring friendly enough to enjoy the rematch.', 'fitness', 'indoor', 'two', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-roller-skating', NULL, NULL, 'Go roller skating', 'Choose a beginner-friendly public session and take the first laps slowly together.', 'fitness', 'indoor', 'two', 'adventurous', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-couples-pilates', NULL, NULL, 'Try a gentle Pilates session', 'Follow a beginner class or reputable video and focus on moving comfortably rather than perfectly.', 'fitness', 'either', 'one', 'normal', 'under_1_hour', '', 1, 1, 0, 0),
  ('builtin-beginner-tennis', NULL, NULL, 'Try a beginner tennis session', 'Book a court or lesson, practise simple rallies, and count the longest one instead of points.', 'fitness', 'outdoor', 'two', 'adventurous', 'one_to_three_hours', '', 1, 1, 0, 0),

  ('builtin-ferry-day-trip', NULL, NULL, 'Take a ferry day trip', 'Choose a practical return route, spend a few hours exploring, and enjoy the journey as part of the date.', 'travel', 'either', 'three', 'normal', 'whole_day', '', 1, 1, 0, 0),
  ('builtin-cabin-night', NULL, NULL, 'Book one night in a cabin', 'Choose a comfortable nearby stay, bring simple food, and leave the schedule deliberately light.', 'travel', 'either', 'three', 'lazy', 'whole_day', '', 1, 1, 0, 0),
  ('builtin-seaside-day', NULL, NULL, 'Take a seaside day trip', 'Pick a coast you can reach easily, walk the promenade, and share something warm before heading home.', 'travel', 'outdoor', 'two', 'normal', 'whole_day', '', 1, 1, 0, 0),
  ('builtin-station-board-adventure', NULL, NULL, 'Choose a trip from the station board', 'Set a travel-time limit, pick an unfamiliar reachable stop, and check the return options before leaving.', 'travel', 'either', 'two', 'adventurous', 'whole_day', '', 1, 1, 0, 0),

  ('builtin-karaoke', NULL, NULL, 'Sing karaoke together', 'Choose one duet and one solo each, with enthusiastic applause as the only rule.', 'entertainment', 'indoor', 'two', 'adventurous', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-improv-show', NULL, NULL, 'See an improv comedy show', 'Choose a local performance and make the rest of the evening as unplanned as the show.', 'entertainment', 'indoor', 'two', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-magic-show', NULL, NULL, 'Go to a magic show', 'Find a well-reviewed live show and compare theories without trying too hard to solve every trick.', 'entertainment', 'indoor', 'three', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-open-mic', NULL, NULL, 'Visit an open-mic night', 'Choose a relaxed venue, support the performers, and pick a favourite moment afterwards.', 'entertainment', 'indoor', 'one', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),

  ('builtin-map-grid-adventure', NULL, NULL, 'Explore a random map square', 'Pick a nearby map grid you rarely visit and find one view, one shop, and one good place to pause.', 'exploring', 'either', 'one', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-hidden-courtyards', NULL, NULL, 'Look for hidden courtyards and passages', 'Walk an older neighbourhood and notice the small public spaces most people hurry past.', 'exploring', 'outdoor', 'free', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-street-art-route', NULL, NULL, 'Follow a street-art route', 'Find a public mural trail, photograph your favourites, and learn about one local artist.', 'exploring', 'outdoor', 'free', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-independent-shops', NULL, NULL, 'Explore independent shops', 'Choose one street or neighbourhood and visit only independent shops and cafes for the afternoon.', 'exploring', 'either', 'one', 'normal', 'half_day', '', 1, 1, 0, 0),

  ('builtin-pumpkin-patch', NULL, NULL, 'Visit a pumpkin patch', 'Choose an in-season farm, take an autumn photograph, and pick one pumpkin to use at home.', 'seasonal', 'outdoor', 'two', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-blossom-walk', NULL, NULL, 'Take a spring blossom walk', 'Find a public park or tree-lined street at its peak and bring a small picnic.', 'seasonal', 'outdoor', 'free', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-summer-lido', NULL, NULL, 'Spend an afternoon at an outdoor pool', 'Choose a supervised public lido, pack sun protection, and take the day at an easy pace.', 'seasonal', 'outdoor', 'two', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-winter-lights', NULL, NULL, 'Walk a winter lights trail', 'Choose a public illuminated route, wrap up warmly, and share a hot drink afterwards.', 'seasonal', 'outdoor', 'two', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),

  ('builtin-photo-booth-tour', NULL, NULL, 'Find a photo booth and take a strip', 'Dress for the occasion, choose four different expressions, and keep the strip somewhere visible.', 'photography', 'indoor', 'one', 'normal', 'under_1_hour', '', 1, 1, 0, 0),
  ('builtin-recreate-photo', NULL, NULL, 'Recreate an old photograph', 'Choose one shared picture, return to a similar setting, and copy the pose as closely as possible.', 'photography', 'either', 'free', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-alphabet-photos', NULL, NULL, 'Try an alphabet photo hunt', 'Photograph objects or signs for as many letters as you can during one walk.', 'photography', 'outdoor', 'free', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-golden-hour-portraits', NULL, NULL, 'Take golden-hour portraits', 'Choose an open location, take turns behind the camera, and keep the session relaxed and short.', 'photography', 'outdoor', 'free', 'normal', 'under_1_hour', '', 1, 1, 0, 0),

  ('builtin-record-store-swap', NULL, NULL, 'Choose music for each other in a record shop', 'Set a budget, browse separately, and reveal the album or single that made you think of the other.', 'shopping', 'indoor', 'two', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-antique-centre', NULL, NULL, 'Explore an antique centre', 'Find the most beautiful, useful, and mysterious objects without needing to buy any of them.', 'shopping', 'indoor', 'one', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-makers-market', NULL, NULL, 'Visit an independent makers market', 'Meet local makers, choose one shared favourite stall, and buy only if something feels special.', 'shopping', 'either', 'two', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-ten-pound-gifts', NULL, NULL, 'Do a ten-pound gift exchange', 'Split up for twenty minutes, stay within the limit, and choose something thoughtful or funny.', 'shopping', 'indoor', 'one', 'normal', 'under_1_hour', '', 1, 1, 0, 0),

  ('builtin-language-cafe', NULL, NULL, 'Visit a language cafe', 'Join a welcoming beginner event and learn enough phrases to order an imaginary meal together.', 'learning', 'indoor', 'one', 'normal', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-cookery-workshop', NULL, NULL, 'Take a cookery workshop', 'Choose a beginner class for a dish neither of you makes at home and divide the work evenly.', 'learning', 'indoor', 'three', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-astronomy-talk', NULL, NULL, 'Attend an astronomy talk', 'Find a public lecture or observatory event and each choose one question to explore afterwards.', 'learning', 'indoor', 'one', 'lazy', 'one_to_three_hours', '', 1, 1, 0, 0),
  ('builtin-first-aid-class', NULL, NULL, 'Take a first-aid class together', 'Book a recognised introductory course and turn a useful skill into a shared learning day.', 'learning', 'indoor', 'three', 'normal', 'whole_day', '', 1, 1, 0, 0),

  ('builtin-kindness-date', NULL, NULL, 'Plan an acts-of-kindness date', 'Choose three small practical ways to help people or places around you without expecting recognition.', 'other', 'either', 'one', 'normal', 'half_day', '', 1, 1, 0, 0),
  ('builtin-sunday-ritual', NULL, NULL, 'Create a Sunday ritual', 'Design one simple hour you would enjoy repeating, with a drink, a walk, or a shared reset.', 'other', 'either', 'free', 'lazy', 'under_1_hour', '', 1, 1, 0, 0),
  ('builtin-question-jar', NULL, NULL, 'Make a relationship question jar', 'Write curious, warm, and playful questions on slips of paper and answer a few over dinner.', 'other', 'home', 'free', 'lazy', 'under_1_hour', '', 1, 1, 0, 0),
  ('builtin-themed-day', NULL, NULL, 'Plan a themed day for each other', 'Choose a colour, place, decade, or story and let it guide the food, music, and one activity.', 'other', 'either', 'two', 'normal', 'whole_day', '', 1, 1, 0, 0);
