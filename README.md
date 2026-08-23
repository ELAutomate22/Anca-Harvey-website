# Our Corner

Our Corner is a private, two-person relationship archive. Phase 3 keeps the Phase 1 editorial React experience and Phase 2 security model, then adds live TMDB movie discovery plus shared Movie Night, Game Night, and Soundtrack data.

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
- D1 holds exactly two users, one relationship, hashed sessions, login-attempt state, Memories metadata, media metadata, timeline entries, movie watchlist/history/ratings, games/history, songs, and idempotency records.
- R2 holds only photos and videos uploaded by an authenticated partner. The bucket must remain private; browsers receive media through `/api/media/:mediaId` after server-side membership checks.
- Developer-provided imagery, fonts, textures, and decorative media remain in `public/` or `src/assets/`. They are deployed as ordinary site assets, never copied to D1/R2, and are outside future relationship backups.

There is no public registration, setup endpoint, password-reset flow, Supabase, Firebase, or browser-stored auth token. Date Ideas, Letters, Bucket List, recap persistence, and export remain intentionally outside Phase 3.

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

Foreign keys and focused indexes cover membership, session expiry, relationship/date pagination, favourites, media ordering, timeline ordering, and idempotency cleanup.

## Memories and media

Memory list responses are cursor-paginated (20 by default, 50 maximum), default to newest memory date, and support oldest-first, category, favourite, image, and video filters. A memory can contain up to 12 mixed attachments.

| Type | Accepted MIME types | Per-file limit |
| --- | --- | --- |
| Images | JPEG, PNG, WebP, AVIF | 20 MB |
| Videos | MP4, WebM | 80 MB |

The UI creates metadata idempotently, uploads each selected file separately, shows accessible per-file progress, preserves failed files for retry, and does not claim success before R2 confirms it. Media records expose `/api/media/:mediaId`, never the R2 object key. Delivery supports `HEAD`, ETag validation, private caching, and byte ranges for video seeking.

Deleting a memory or attachment deletes its D1 metadata and attempts R2 cleanup. Unexpected cleanup failures are logged without cookies, passwords, tokens, or private text.

## API

All API responses use `{ success: true, data }` or `{ success: false, error: { code, message, details? } }`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | minimal environment health status |
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

All protected frontend routes redirect unauthenticated users to the cinematic login. The route guard is only UX; the Worker remains authoritative.

## Production Cloudflare setup

The production D1 database, private R2 bucket, two users, relationship, and origins already exist for the current site. Do not recreate or reprovision them for Phase 3; the creation steps below are retained only for a completely new environment. Phase 3 production needs the new migration, the TMDB secret, and a Worker/frontend deployment.

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

   The script writes only salted password hashes to D1, builds SQL in a permission-restricted temporary directory, removes it after Wrangler exits, and does not print the credentials.

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

10. Visit `/api/health`, sign in with each account, verify movie discovery, add and remove a temporary watchlist/diary/game/song entry, upload a temporary image and video, verify seeking/private access, delete the test data, sign out, and confirm the private route returns to `/login`.

No runtime `SESSION_SECRET` is needed by the chosen server-side session design: session tokens are cryptographically random and only their hashes are stored. The provisioning values are one-time process environment inputs, not Worker bindings and never `VITE_*` variables. `TMDB_API_READ_TOKEN` is the only Phase 3 runtime secret and belongs in Wrangler secrets (or local `.dev.vars`), never in Vite or source control.

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

## Frontend routes

`/movies`, `/games`, and `/soundtrack` now consume the Phase 3 API while preserving their Phase 1 visual language. All application pages remain protected by login, and every Phase 3 Worker route independently verifies the session and relationship membership.

The Settings → About section contains the approved TMDB logo and required notice: “This product uses the TMDB API but is not endorsed or certified by TMDB.” No copyrighted music is stored; Soundtrack contains metadata, optional authenticated image associations, and allowlisted Spotify/YouTube links only.

The backend relationship record is the runtime source of truth for profile names, title, start date, and timezone. `src/config/relationship.ts` remains the typed development/loading fallback so the frontend does not crash before local provisioning.
