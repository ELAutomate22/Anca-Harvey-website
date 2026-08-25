# Our Corner

Our Corner is a private, two-person relationship archive. Phase 8 keeps the editorial React experience and established security model, with shared Memories, Story, Movie Night, Game Night, Soundtrack, activities, a bucket list, server-time-locked Letters to the Future, secure portable backups, and real anniversary-based relationship retrospectives.

## Architecture

```text
React + Vite static assets
          |
          | same-origin /api requests
          v
Cloudflare Worker (authentication, authorization, validation)
          |                         |
          v                         v
Cloudflare D1                  Private Cloudflare R2
structured app data           authenticated user uploads only
```

- The Worker entry point is `worker/src/index.ts`; routes and security helpers are split under `worker/src/`.
- D1 holds exactly two users, one relationship, hashed sessions, login-attempt state, Memories metadata, media metadata, timeline entries, movie watchlist/history/ratings, games/history, songs, activities/plans/history, bucket-list items, future letters/page metadata, idempotency records, and lightweight backup job/history metadata.
- R2 holds only photos, videos, and future-letter scans uploaded by an authenticated partner. The bucket must remain private; browsers receive media only through Worker routes after server-side authorization.
- Developer-provided imagery, fonts, textures, and decorative media remain in `public/` or `src/assets/`. They are deployed as ordinary site assets, never copied to D1/R2, and are outside every relationship backup.

There is no public registration, setup endpoint, password-reset flow, Supabase, Firebase, or browser-stored auth token. Restore/import remains intentionally deferred.

Phase 8 Anniversary Wrapped is a dynamic read model, not a stored snapshot. `/recap` indexes anniversary-based relationship years; `/recap/year/:yearNumber` assembles one completed or current chapter from D1 history; and Home shows “This Day” only when exact prior-year content exists. Relationship years begin on `relationships.start_date`, not 1 January. A 29 February start is observed on 28 February in non-leap years, and all “today”/timestamp boundaries use the relationship IANA timezone.

Recap data is intentionally selective: Memories and their D1-indexed private uploads, timeline entries, watched movie history, played game history, persistent songs, completed activities, bucket additions/completions, and opened-Letter metadata only. Watchlists, activity suggestions/plans, mock data, developer static assets, TMDB poster binaries, drafts, locked/ready Letters, and future rows are excluded. The Worker never selects Letter bodies or Letter media for retrospective responses.

TMDB is called only by the authenticated Worker. The application Read Access Token is a Worker secret named `TMDB_API_READ_TOKEN`; it is never a `VITE_*` variable, frontend value, committed config value, or API response. TMDB catalogue data stays authoritative, while D1 stores only relationship-owned selections and small movie snapshots.

## Security model

- Production users are provisioned from process environment values by `scripts/provision-users.mjs`; plaintext credentials are not stored.
- Passwords use scrypt with a random 16-byte salt and OWASP's `N=2^15, r=8, p=3` profile.
- Sessions use an unpredictable cookie token while D1 stores only its SHA-256 hash. The `__Host-our-corner-session` cookie is `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, and expires after 30 days.
- Every private query derives the relationship from the authenticated session. Browser-supplied relationship IDs are not trusted.
- Mutations validate the configured Origin, reject cross-site fetches, and validate Host in production. CORS is credentialed only for the configured origin.
- Login failures are generic and D1-backed throttling locks repeated attempts for 15 minutes.
- Queries use bound D1 statements. Text, dates, timezones, MIME types, sizes, and file signatures are validated server-side.
- API errors use a stable `{ success: false, error: { code, message } }` shape and do not return SQL, R2, stack, hash, or cookie details.
- CSP, clickjacking, MIME-sniffing, referrer, permissions, and private-cache headers are set by the Worker.
- Future-letter readiness and opening are derived from Worker time and the sealed D1 `unlock_at`; browser time, request payloads, query parameters, and frontend state cannot authorize an open.
- Future-letter drafts are creator-private. Sealed and ready responses use a safe metadata serializer that cannot include typed bodies, media IDs/URLs, Base64 content, or R2 keys. Private page delivery repeats the letter-state authorization on every request.
- User backups use explicit relationship-scoped D1 queries; authentication tables, session rows, password hashes, logs, secrets, raw SQL dumps, and browser-supplied relationship IDs never enter the archive.
- Full Backup requires a recent password confirmation when the current session authentication is older than ten minutes. The password is verified by the existing scrypt login system and is not retained.
- Direct download authorization is short-lived and requester-bound. ZIP responses use `private, no-store`, `nosniff`, attachment disposition, SameSite session cookies, and same-site download checks.

## Local setup

Prerequisites: Node.js and pnpm. Local D1 and R2 emulation do not require live Cloudflare resources.

```bash
pnpm install
pnpm db:migrate:local
pnpm db:provision:local
pnpm dev:full
```

For live local movie discovery, create a gitignored `.dev.vars` file and add the `TMDB_API_READ_TOKEN` binding using your own TMDB application Read Access Token. The repository documents the binding name only and does not contain a token.

Open `http://localhost:5173`. The deliberately fake local accounts are:

| Account | Password |
| --- | --- |
| `partner.one@example.test` | `LocalOnly-Partner-One!2026` |
| `partner.two@example.test` | `LocalOnly-Partner-Two!2026` |

These values are only for local development. `db:provision:local` upserts the same two fake users and the local relationship, so it can be rerun safely. It never scans or seeds static assets.

Useful commands:

| Command | Purpose |
| --- | --- |
| `pnpm dev:web` | Vite frontend on port 5173; `/api` proxies to the Worker |
| `pnpm dev:worker` | local Worker/D1/R2 on port 8787 |
| `pnpm dev:full` | frontend and Worker together |
| `pnpm db:migrate:local` | apply all D1 migrations locally |
| `pnpm db:provision:local` | create/update the two fake accounts and relationship |
| `pnpm test:e2e:local` | exercise login → D1 → image/video R2 upload → range delivery → cleanup; requires the Worker running |
| `pnpm cf:types` | regenerate typed Cloudflare bindings |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` | validation suites |
| `pnpm build` / `pnpm build:worker` | frontend build and production Worker dry-run |

Local Wrangler state is under `.wrangler/` and is ignored by source control. To rebuild local data from scratch, remove only that local Wrangler state, rerun migrations, then reprovision.

## D1 schema and migrations

Migrations in `migrations/` are the complete reproducible schema. Do not create production tables manually in the dashboard.

- `users`: two-account limit, emails, display names, scrypt hashes, active state.
- `relationships`: the sole partner membership record, title, start date, and IANA timezone.
- `sessions`: hashed tokens, expiry, last-seen time, privacy-preserving request metadata hashes.
- `login_attempts`: brute-force throttling state.
- `memories`: title, plain-text caption, optional location, date, flexible category, favourite flag, creator, timestamps.
- `memory_media`: R2 key (server-only), safe filename metadata, media type/MIME/size, alt text, order, optional dimensions/duration.
- `timeline_entries`: custom chronological Story records.
- `idempotency_keys`: duplicate-create protection with expiry.
- `movie_watchlist`: one shared row per relationship/TMDB movie, with a compact display snapshot.
- `movie_history` and `movie_history_ratings`: rewatch-safe diary entries with normalized half-star partner ratings.
- `games` and `game_history`: immutable starter games, relationship-owned custom games, outcomes, winners, and ratings.
- `songs`: relationship soundtrack metadata, approved HTTPS links, optional memory/upload associations, and a partial unique index for one Our Song.
- `activities`, `activity_exclusions`, and `saved_activities`: 177 immutable starter ideas, relationship-owned custom ideas, per-relationship hiding, shared saves, and searchable category/location/budget/energy/duration filters.
- `activity_suggestions`, `planned_activities`, and `activity_history`: repeat-aware random selections, editable/cancellable calendar plans, completion ratings/notes, attribution, and optional Memory links.
- `bucket_list_items`: shared dreams, categories, priorities, target dates, Dreaming/Planning/Booked/Completed states, completion details, attribution, and optional Memory links.
- `future_letters`: creator, real-profile recipient semantics, plain-text typed content, teaser, immutable sealed UTC unlock instant, opened timestamp, and first opener. The only stored states are `draft → sealed → opened`; `ready` is derived.
- `future_letter_media`: server-only private R2 keys and image metadata for ordered handwritten pages or a typed-letter cover. A trigger backs up the application-level 12-page limit during concurrent uploads.
- `backup_jobs`: requester/type/status attribution, snapshot and completion times, counts, sizes, short download authorization expiry, and safe error codes. It never stores archive content, passwords, Letter bodies, URLs, or R2 keys.

Foreign keys and focused indexes cover membership, session expiry, relationship/date pagination, favourites, media ordering, timeline ordering, and idempotency cleanup.

Phase 7 remains additive: `0008_backup_jobs.sql` adds `sessions.recent_auth_at`, the backup job/history table, focused history/expiry indexes, and a partial unique index enforcing one active Full Backup per relationship. Previously applied migrations are unchanged.

Phase 8 requires no recap-storage migration. Its bounded, parameterized D1 aggregates are derived on request, so edits to source history are reflected immediately and no duplicate recap table can drift out of sync.

`0009_expand_date_ideas.sql` adds 76 new immutable starter ideas without changing the schema or touching existing saved, hidden, planned, or completed activity records.

## Memories and media

Memory list responses are cursor-paginated (20 by default, 50 maximum), default to newest memory date, and support oldest-first, category, favourite, image, and video filters. A memory can contain up to 12 mixed attachments.

| Type | Accepted MIME types | Per-file limit |
| --- | --- | --- |
| Images | JPEG, PNG, WebP, AVIF | 20 MB |
| Videos | MP4, WebM | 80 MB |

The UI creates metadata idempotently, uploads each selected file separately, shows accessible per-file progress, preserves failed files for retry, and does not claim success before R2 confirms it. Media records expose `/api/media/:mediaId`, never the R2 object key. Delivery supports `HEAD`, ETag validation, private caching, and byte ranges for video seeking.

Deleting a memory or attachment deletes its D1 metadata and attempts R2 cleanup. Unexpected cleanup failures are logged without cookies, passwords, tokens, or private text.

## Letters to the Future

`/letters` contains Create, Draft, Sealed, Ready, and Opened experiences on one responsive page. A creator can type plain text on accessible stationery or upload 1–12 JPEG, PNG, WebP, or AVIF handwritten pages (20 MB maximum per image). Drafts support debounced autosave plus an explicit save, per-page upload progress/retry, removal, accessible Up/Down ordering, real-profile recipients, quick anniversary/milestone dates, custom relationship-local date/time, and a final preview.

The relationship's D1 `start_date` powers quick anniversary and six-month suggestions. The chosen local date/time is converted using the relationship's IANA timezone and stored as a UTC epoch. With no explicit time, the documented default is `00:00` in that timezone. Changing the relationship date later does not move an existing letter, and changing timezone after sealing never changes the stored instant; only its display changes.

Sealing is a one-way Worker transaction. The Worker reloads the creator-owned draft, validates title/content or pages, recipient, and a future unlock instant, then stamps `sealed_at` with server time. All draft fields and media operations reject sealed letters. Deletion remains available only to the creator, requires the exact confirmation `DELETE`, cascades D1 metadata, and removes associated private R2 objects.

The browser countdown is visual only and is anchored to the last Worker `serverNow`. At zero it refreshes metadata; it never reveals content. `POST /api/letters/:id/open` reloads D1, ignores browser-supplied time, compares the sealed timestamp with Worker time, enforces individual-recipient or both-of-us opening rules, and atomically records the first opener. Individual letters initially open only for the chosen recipient; both-of-us letters may be opened by either member. After the first valid open, both partners may revisit it from the shared archive. Repeated opens are idempotent.

Locked list/detail responses do not place content in the browser response. Draft content is returned only to its creator, and opened content is fetched on demand rather than included in the grid. A guessed `/api/letters/:letterId/pages/:mediaId` request repeats authentication, relationship, draft ownership, and opened-state checks before reading R2; locked pages use `private, no-store` and cannot be obtained at the ready-but-unopened stage.

Application-level encryption at rest is deliberately not introduced because it would add key-loss and recovery risk. The mandatory protection boundary is private D1/R2 behind the authenticated Worker and its server-authoritative lock. The Phase 7 export query enforces this boundary before serialization: locked and ready-but-unopened content is never selected, opened content is eligible, and requester drafts require a separate explicit option.

## Data & Backup

Settings → Data & Backup provides two real downloads:

- **Export Data Only** creates a small ZIP with the versioned manifest, README, canonical JSON, and supplementary UTF-8 CSV. It includes safe media metadata but no photo/video/page binaries.
- **Download Full Backup** creates the same portable records plus every eligible original user-uploaded Memory image/video and opened handwritten Letter page. If requested, it may also include only the signed-in user’s own draft content/media.

Both use backup format `1.0`, documented in [`docs/backup-format-v1.md`](docs/backup-format-v1.md). Stable entity/media IDs and links are preserved for a future separately designed restore phase. Passwords, password hashes, sessions, cookies, login-attempt data, API/Cloudflare secrets, private URLs, R2 keys, source code, raw D1 dumps, TMDB poster binaries, and developer-provided static assets are structurally excluded.

The Worker chooses direct streaming because the current project already has authenticated D1/R2 bindings but no configured Workflow or temporary backup bucket. `client-zip` consumes a lazy async iterable, emits standard STORE entries with ZIP64 support, and returns a Web `ReadableStream`. Each R2 body is fetched from the D1-declared media plan and streamed sequentially; the Worker never lists the bucket, scans the deployed site, buffers a whole media object/archive, or launches all media reads concurrently. Missing referenced objects produce a safe manifest warning while the remaining archive completes.

A POST creates a requester-bound D1 job with a 15-minute window to start the one-shot direct download. Full Backup checks recent authentication and only one active Full Backup is permitted per relationship. The download endpoint creates a single D1 transaction-backed metadata snapshot, freezes Letter eligibility at that instant, then streams. The job becomes successful only after the ZIP stream closes; interrupted streams become failed and require a fresh request. Because no staged archive exists, there is no duplicate archive object, presigned URL, lifecycle rule, or cleanup binding.

The size card sums eligible D1 `size_bytes` metadata and never reads R2 merely to estimate size. Backup history stores only requester, type, state, safe counts/sizes/errors, and timing. Generated ZIPs are not retained. The archive is not encrypted; obsolete ZipCrypto is deliberately avoided, and the UI reminds the user to store the authenticated HTTPS download somewhere trusted.

Restore/import, ZIP upload, merge, and database replacement are not implemented.

## API

All API responses use `{ success: true, data }` or `{ success: false, error: { code, message, details? } }`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | minimal environment health status |
| `GET` | `/api/recap` | relationship-year index, current/completed states, anniversary flag, and comparison when two years are complete |
| `GET` | `/api/recap/current` | bounded real-data story for the active relationship year |
| `GET` | `/api/recap/year/:yearNumber` | bounded real-data story for one current/completed anniversary year |
| `GET` | `/api/this-day` | exact month/day memories and milestones from prior years |
| `POST` | `/api/auth/login` | validate one of the two accounts and create a session |
| `GET` | `/api/auth/me` | current safe user, relationship, and both profiles |
| `POST` | `/api/auth/logout` | invalidate the D1 session and clear the cookie |
| `GET/PATCH` | `/api/relationship` | load/update title, start date, timezone; date changes require confirmation |
| `GET` | `/api/profiles` | both safe partner profiles |
| `PATCH` | `/api/profiles/me` | update the signed-in partner's display name |
| `GET/POST` | `/api/memories` | paginated list/create (`Idempotency-Key` required for create) |
| `GET/PATCH/DELETE` | `/api/memories/:id` | load/edit/delete a relationship-owned memory |
| `POST` | `/api/memories/:id/media` | validate and upload one attachment |
| `DELETE` | `/api/memories/:id/media/:mediaId` | remove one attachment |
| `GET/HEAD` | `/api/media/:mediaId` | authorized private R2 streaming/range delivery |
| `GET/POST` | `/api/timeline` | list/create custom Story entries |
| `PATCH/DELETE` | `/api/timeline/:id` | update/delete a custom Story entry |
| `GET` | `/api/movies/genres`, `/popular`, `/top-rated`, `/search`, `/discover` | authenticated live TMDB catalogue |
| `GET` | `/api/movies/:id`, `/api/movies/:id/videos` | details and lazily requested trailers |
| `GET/POST` | `/api/movies/watchlist` | list/add shared watchlist entries |
| `DELETE` | `/api/movies/watchlist/:tmdbId` | remove a watchlist entry |
| `GET/POST` | `/api/movies/history` | list/create rewatch-safe diary entries |
| `PATCH/DELETE` | `/api/movies/history/:id` | edit/delete a diary entry and ratings |
| `GET` | `/api/movies/stats` | real watchlist/diary statistics |
| `GET/POST` | `/api/games` | starter/custom game library |
| `PATCH/DELETE` | `/api/games/:id` | edit/delete a custom game only |
| `GET/POST` | `/api/games/history` | list/create game-night history |
| `PATCH/DELETE` | `/api/games/history/:id` | edit/delete a game-night entry |
| `GET` | `/api/games/stats` | real outcomes, wins, ratings, and most-played data |
| `GET/POST` | `/api/songs` | list/create soundtrack entries |
| `PATCH/DELETE` | `/api/songs/:id` | manage songs and atomically change Our Song |
| `GET/POST` | `/api/activities` | filter the visible catalogue or create a custom idea |
| `POST` | `/api/activities/random` | record and return a combined-filter, recent-repeat-aware suggestion |
| `POST/DELETE` | `/api/activities/:id/save`, `/hide` | share saves or hide/restore catalogue ideas |
| `PATCH/DELETE` | `/api/activities/:id` | edit/soft-delete a custom idea only |
| `GET/POST` | `/api/planned-activities` | list or schedule shared dates |
| `PATCH/DELETE` | `/api/planned-activities/:id` | edit or cancel an upcoming plan |
| `POST` | `/api/planned-activities/:id/complete` | complete once, optionally creating one linked Memory |
| `GET/PATCH/DELETE` | `/api/activity-history/:id?` | list, edit, or delete completion history |
| `GET` | `/api/activities/stats` | completed, rating, saved, planned, and category totals |
| `GET/POST` | `/api/bucket-list` | list/filter or add shared dreams |
| `PATCH/DELETE` | `/api/bucket-list/:id` | edit, move, reopen, or delete a dream |
| `POST` | `/api/bucket-list/:id/complete` | record completion and optionally create one linked Memory |
| `GET` | `/api/bucket-list/random`, `/stats` | choose an unfinished dream and report real progress |
| `GET` | `/api/backup/estimate` | D1-only eligible media/file/Memory estimate and recent-auth state |
| `POST` | `/api/backup/reauthenticate` | verify the current password and refresh this session’s short recent-auth window |
| `POST` | `/api/backup/data`, `/api/backup/full` | create a requester-bound Data Only or Full Backup job |
| `GET` | `/api/backup/history` | shared safe job history and last-successful record |
| `GET` | `/api/backup/jobs/:id` | relationship-authorized status without internal keys/errors |
| `GET` | `/api/backup/jobs/:id/download` | requester-bound, one-shot, private streaming ZIP download |
| `GET/POST` | `/api/letters` | safe visible-envelope list and private draft creation |
| `GET` | `/api/letters/summary`, `/quick-dates` | content-free metrics and relationship-derived date suggestions |
| `GET/PATCH/DELETE` | `/api/letters/:id` | state-aware detail, creator-only draft edit, or strongly confirmed creator deletion |
| `POST` | `/api/letters/:id/seal`, `/open` | immutable server seal or server-authorized intentional open |
| `POST` | `/api/letters/:id/media` | creator-only draft page/cover upload to private R2 |
| `PATCH` | `/api/letters/:id/media/order` | reorder the exact draft page set |
| `DELETE` | `/api/letters/:id/media/:mediaId` | remove one creator-owned draft image |
| `GET/HEAD` | `/api/letters/:id/pages/:mediaId` | state-authorized private R2 letter image delivery |

All protected frontend routes redirect unauthenticated users to the cinematic login. The route guard is only UX; the Worker remains authoritative.

## Production Cloudflare setup

The production D1 database, private R2 bucket, two users, relationship, origins, and TMDB secret already exist for the current site. Do not recreate or reprovision them for Phase 7; the creation steps below are retained only for a completely new environment. A Phase 7 release applies migrations in order, deploys the Worker, builds the frontend, then deploys the static `dist` directory through its selected host.

1. Authenticate Wrangler:

   ```bash
   pnpm exec wrangler login
   ```

2. Create D1 and copy the returned database ID into `env.production.d1_databases[0].database_id` in `wrangler.jsonc`:

   ```bash
   pnpm exec wrangler d1 create our-corner-db
   ```

3. Create the R2 bucket. Leave its `r2.dev` URL and custom public domains disabled:

   ```bash
   pnpm exec wrangler r2 bucket create our-corner-private-media
   ```

4. Set `env.production.vars.ALLOWED_ORIGIN` in `wrangler.jsonc` to the final HTTPS frontend origin, and set `API_ORIGIN` to the deployed Worker origin. When Netlify serves the frontend, keep the external `/api/*` rewrite in `netlify.toml` pointed at that same Worker origin. This same-origin browser path is required for the secure session cookie.

5. Apply the schema:

   ```bash
   pnpm db:migrate:remote
   ```

6. Add the production TMDB secret interactively. Paste the application Read Access Token only into Wrangler's hidden prompt:

   ```bash
   pnpm exec wrangler secret put TMDB_API_READ_TOKEN --env production
   ```

7. Run the secure interactive production provisioner only when initially creating or deliberately rotating the two accounts. It masks and confirms both passwords, requires at least 14 characters, and clears the temporary process variables after provisioning. Do not put real values in `.env`, `.dev.vars`, shell history, screenshots, tickets, or source control.

   ```bash
   pnpm db:provision:remote:prompt
   ```

   The script writes only salted password hashes to D1, builds SQL in a permission-restricted temporary directory, removes it after Wrangler exits, and does not print the credentials. Phase updates must not rerun this step unless the two account owners intentionally rotate their credentials.

8. Validate and deploy:

   ```bash
   pnpm typecheck
   pnpm lint
   pnpm test
   pnpm build
   pnpm build:worker
   pnpm deploy
   ```

9. If Netlify hosts the frontend, deploy `dist` with `netlify.toml`, then make the Netlify project public at the platform layer. The application remains private because every route and API action uses the two-account login; leaving Netlify's separate account gate enabled would require each visitor to have a Netlify account.

   ```bash
   npx netlify deploy --prod --dir=dist
   ```

10. Visit `/api/health`, sign in with each account, verify shared movie/game/song/activity/bucket data, then test a short-future individual letter and both-of-us letter. Inspect the locked network response, verify neither content nor media access is present, confirm the recipient rules after real backend unlock, remove temporary data, sign out, and confirm the private route returns to `/login`.

No runtime `SESSION_SECRET` is needed by the chosen server-side session design: session tokens are cryptographically random and only their hashes are stored. The provisioning values are one-time process environment inputs, not Worker bindings and never `VITE_*` variables. `TMDB_API_READ_TOKEN` remains the only catalogue runtime secret and belongs in Wrangler secrets (or local `.dev.vars`), never in Vite or source control.

Phase 8 adds no recap table, environment variable, secret, Workflow, Queue, scheduled trigger, lifecycle rule, bucket, or binding. Migration `0009_expand_date_ideas.sql` adds the larger starter date catalogue and must be applied before the Worker/frontend release. Existing `DB` and private `MEDIA` bindings are reused. Do not rerun account provisioning.

## Troubleshooting

- `401` after login: use `http://localhost:5173`, run both Vite and the Worker, reprovision local accounts, and do not call port 8787 directly from the browser UI.
- `403 ORIGIN_NOT_ALLOWED` or `HOST_NOT_ALLOWED`: make `ALLOWED_ORIGIN` exactly match the browser origin, including scheme and port locally.
- `no such table`: run the appropriate local or remote migration command before provisioning.
- missing D1/R2 binding: regenerate types, confirm the `DB` and `MEDIA` names in `wrangler.jsonc`, and restart Wrangler.
- upload `415`: the declared MIME type or file signature is unsupported/mismatched. Renaming an extension does not change file content.
- upload `413`: keep images at or below 20 MB and videos at or below 80 MB.
- video does not seek: verify the request passes through `/api/media/:mediaId` and the browser receives `206`, `Accept-Ranges`, and `Content-Range`.
- production deployment uses a placeholder database ID/origin: replace both placeholders before running remote migrations or deploy.
- `TMDB_NOT_CONFIGURED`: create local `.dev.vars` or set the production `TMDB_API_READ_TOKEN` Worker secret, then restart/redeploy the Worker.
- TMDB catalogue errors: confirm the value is the application Read Access Token, not a browser key, and check the TMDB status page before changing application data.
- `LETTER_LOCKED`: the Worker has not reached the sealed UTC unlock instant. Device-clock changes are intentionally ignored.
- `INVALID_LOCAL_TIME`: choose a valid clock time in the relationship timezone; DST spring-forward gaps do not exist.
- letter page upload `409`: keep handwritten letters to 12 pages, retry a failed page, or remove another page before adding it.
- `RECENT_AUTH_REQUIRED`: confirm the current password in the Full Backup dialog; existing long-lived sessions intentionally have no recent-auth timestamp until this succeeds.
- backup download `410`: the 15-minute direct-download start window expired; create a fresh backup request.
- backup completes with warnings: inspect `manifest.json` and `warnings/missing-media.json`; a D1-indexed R2 object was missing/unavailable, while original relationship records were unchanged.
- interrupted backup: direct archives are not staged or retained, so create a fresh request and keep the Settings page/browser download open until streaming completes.

## Frontend routes

`/movies`, `/games`, `/soundtrack`, `/activities`, `/bucket-list`, `/letters`, `/recap`, and `/recap/year/:yearNumber` consume authenticated APIs while preserving the editorial visual language. Activities provides Generator, Catalogue, Saved, Plans, and History views. Bucket List provides real statuses, filters, random picks, completion progress, and Memory-backed photos. Letters provides a typed/uploaded composer, server-sealed envelopes, recipient-aware Ready actions, and an opened archive. Home uses only content-free letter counts, safe opened-letter retrospective metadata, and exact “This Day” results; it never exposes drafts. Every Worker route independently verifies the session and relationship membership.

Activity and bucket completion uploads do not create a second media system. The completion transaction optionally creates one normal `memories` row and stores its ID on the history/item record; the existing `/api/memories/:id/media` route owns validation and private R2 uploads. Removing a history or bucket link never silently deletes that Memory.

The Settings → About section contains the approved TMDB logo and required notice: “This product uses the TMDB API but is not endorsed or certified by TMDB.” No copyrighted music is stored; Soundtrack contains metadata, optional authenticated image associations, and allowlisted Spotify/YouTube links only.

The backend relationship record is the runtime source of truth for profile names, title, start date, and timezone. `src/config/relationship.ts` remains the typed development/loading fallback so the frontend does not crash before local provisioning.
