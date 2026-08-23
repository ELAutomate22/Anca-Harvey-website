# Project Rules

- Preserve the editorial, cinematic design system and build mobile-first.
- Keep TypeScript strict; use typed mock data and reusable components.
- Use D1 relationship/profile data at runtime; `src/config/relationship.ts` is the only static/loading fallback for names, title, date, and timezone.
- Keep developer-provided static media in the source project; never model it as user content.
- Cloudflare is the backend: D1 stores structured application data and private R2 stores only authenticated user uploads.
- The Worker must enforce authentication, relationship membership, validation, and private R2 delivery; never expose R2 object keys.
- Keep exactly two deliberately provisioned accounts, no public registration, and no secrets in source.
- Keep TMDB behind the Worker using only the `TMDB_API_READ_TOKEN` secret; the browser must never receive it.
- Store only soundtrack metadata and approved outbound links, never copyrighted audio.
- Keep Phase 3 limited to Movie Night, Game Night, and Soundtrack; do not start Phase 4 persistence features.
- Do not add Supabase or Firebase, or invent production authentication/upload behaviour.
- Extend finished components instead of replacing them without cause.
- Run typecheck, lint, tests, and a production build before considering work complete.
