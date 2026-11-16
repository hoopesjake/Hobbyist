# Hobbyist Movies & TV (TMDB)

## What is implemented

- `/movies-tv`: live trending movies and TV, multi-search and movie/TV/person search filters, posters, descriptions, genres, release years, TMDB scores, and pagination.
- `/movies-tv/movie/[id]`, `/movies-tv/tv/[id]`: full descriptions, release/air dates, runtime or season/episode counts, genres, cast links, and a personal viewing journal.
- `/movies-tv/actors/[id]`: biography, portrait, life dates, paginated movie/TV acting filmography, follow/unfollow.
- `/movies-tv/watchlist`: your private library across watchlist, watching, completed, paused, and dropped statuses. Filter by status and open any saved title to edit it.
- `/movies-tv/actors`: your private, paginated followed-actor list with unfollow controls.
- The existing home dashboard shows your currently watching title and recent viewing journal updates. Other hobby cards, friends, notifications, Top 4, and Mosaic remain placeholders. No other integrations were added.
- The existing top-bar destination search now also links your query to the live Movies & TV search.

## Required setup: apply one new migration

The TMDB token was verified with a successful live response. Keep it exclusively in `.env.local` as `TMDB_READ_ACCESS_TOKEN`; never use a `NEXT_PUBLIC_` prefix or commit it. `.env.example` documents the variable without a value. Restart the development server after editing environment variables.

At implementation time, the hosted Supabase project did **not** have the three new tables: the read-only schema check returned `PGRST205` for each. No hosted writes or migrations were performed. Your existing profile migration and user data are preserved.

1. Open your existing Supabase project > SQL Editor > New query.
2. Copy the entire contents of `supabase/migrations/202611160002_tmdb_viewing.sql`.
3. Run it **once**. Do not rerun the original profile migration.
4. Start/restart `npm run dev`, sign in, and open `http://localhost:3000/movies-tv`.

The new migration is transactional and additive. It creates only `viewing_entries`, `actor_follows`, `viewing_events`, indexes, policies, and two trigger functions. It expects these names to be unused. If using an already-linked Supabase CLI migration workflow instead, review `supabase db push --dry-run` before applying with `supabase db push`; reconcile any dashboard-applied migrations with CLI history first.

No additional app dependencies were needed. Catalog browsing works before the migration, but private lists and saves require the migration. The UI reports library failures without presenting a failed query as an empty saved state or overwriting it with defaults.

## Security and data model

TMDB requests run only in `src/lib/tmdb.ts`, which imports `server-only`. The token is sent to the fixed official API origin in an Authorization Bearer header, never URLs, browser props, or logs. Browser assets were scanned for the actual token and no match was found. Image URLs use the public TMDB image CDN with validated paths and an explicit Next Image host allowlist. The official TMDB logo and required attribution are included in the catalog credits footer.

Public TMDB responses use Next.js `use cache`: 15-minute revalidation and one-day expiry, with a 12-second network timeout. Only public catalog data enters this cache. Personal reads use the authenticated Supabase server client and request-local React memoization, with no shared user-data cache. Existing cookie refresh, no-store responses, and authentication remain in place.

Each title is uniquely keyed by `(user_id, media_type, tmdb_id)` so movie and TV IDs cannot collide. Each actor follow is uniquely keyed by `(user_id, tmdb_person_id)`. Saved snapshots let private lists/history display without fetching every saved item from TMDB. Actions fetch canonical title/actor metadata themselves and derive ownership from a server-verified Supabase user; submitted user IDs or title names are not trusted.

Every new table has RLS and explicit grants. Anonymous users have no access. Authenticated users can read/write/remove only their own entries and follows. A public Hobbyist profile does not make viewing data or actor follows public. Creation dates and viewing identity are immutable. Trigger functions have fixed empty search paths and no direct client execution grants. No secret/service-role credentials are needed.

The user rating is **0.5-5 Hobbyist stars in half-star steps**, stored in Supabase; TMDB's **0-10 catalog average** is displayed separately and never overwritten. Dates are optional, validated as real dates, not future dates (UTC server day), and chronologically consistent. Both TypeScript and PostgreSQL enforce the rating/date rules.

`viewing_events` is an owner-readable, append-only journal written by a database trigger whenever a title is added or its status, rating, or dates change. Saving unchanged values does not add duplicate journal entries. Removing a title preserves journal history; deleting the auth account cascades through all three tables. This phase records a title's current start/watch dates plus change snapshots, not a full episode tracker or dedicated rewatch-session system.

## Verified here

- Successful authenticated TMDB read for a real movie and cast (without printing the token).
- Production-server HTTP checks for trending, movie search, TV search, person search, movie and TV detail pages, actor filmography, protected private routes, invalid IDs, and missing titles.
- Lint, TypeScript, and production build.
- Headless Edge browser checks for search submission, title/cast/actor navigation, the top-bar catalog shortcut, mobile layout without horizontal overflow, private-route sign-in redirects, and no browser JavaScript errors.
- Optimized poster and official logo responses, actual mobile-browser poster loading, failed-image fallback, empty search, and catalog/filmography pagination.
- Five Node validation tests covering IDs/types, optional ratings/dates, half-star increments, invalid/future/out-of-order dates, and unknown statuses.
- Both SQL migrations and both RLS test scripts executed successfully in a temporary local PostgreSQL-compatible PGlite engine with Supabase-like auth schema/roles. Tests exercised owner upsert/read/update/delete, follow/unfollow, private journal creation, ownership forgery denial, cross-user read/update/delete denial, anonymous denial, immutable identity, invalid ratings, future dates, and retained journal history.

The local SQL engine is a test fixture, not the hosted Supabase Auth/PostgREST service. Hosted persistence and signed-in browser behavior still require the migration and manual checks below. No real user password, browser session, or account was used to test persistence.

## Run checks again

```powershell
npm run lint
npm run test:media
npm run build
```

The Node tests use native TypeScript loading (Node 22.18+; tested on Node 24). The optional SQL harness needs a temporary test-only package, outside the application dependency tree:

```powershell
npm install --prefix "$env:TEMP\hobbyist-tmdb-sql-check" --no-save --package-lock=false @electric-sql/pglite
$env:HOBBYIST_SQL_TEST_MODULE = "$env:TEMP\hobbyist-tmdb-sql-check\node_modules\@electric-sql\pglite"
node scripts/check-supabase-sql.mjs
```

The harness creates a disposable in-memory database and does not connect to Supabase. For a real disposable/local Supabase database with both migrations applied, run `supabase/tests/tmdb_viewing_rls.sql` as postgres using SQL Editor or `psql -v ON_ERROR_STOP=1 -f supabase/tests/tmdb_viewing_rls.sql`. Fixtures are rolled back. Avoid production for test fixtures because other auth hooks may have side effects.

## Manual acceptance after applying the migration

1. Sign in, search for a real movie, and add it to your library as Watchlist.
2. Refresh; verify it appears in My watchlist and retains its state on the detail page.
3. Change to Watching; verify the home dashboard currently-watching card.
4. Set your rating to 4.5/5, choose a watched date, and mark Completed. Verify the journal and watchlist show the change while the TMDB score remains separate.
5. Sign out and back in; verify persistence. Repeat with a TV show.
6. Open a cast member, follow them, check Followed actors, then unfollow. Confirm pagination and filmography links work.
7. Use two accounts: one user's library, activity, ratings, dates, and follows must remain invisible to the other, including when the first user's profile is public.
8. Try invalid ratings/dates using direct API calls in a test environment; verify database rejection. Remove a title and confirm it leaves the library while prior journal activity remains.
9. Test desktop/mobile layout, missing posters, empty search, search pagination, and the top-bar live-catalog shortcut in a browser.

Existing authentication still requires `NEXT_PUBLIC_SITE_URL` for signup/reset emails as documented in `SUPABASE_SETUP.md`. That variable was absent in the current local environment check; restore `NEXT_PUBLIC_SITE_URL=http://localhost:3000` if you need account emails. The TMDB implementation does not change authentication settings.

Official references: [application authentication](https://developer.themoviedb.org/docs/authentication-application), [multi-search](https://developer.themoviedb.org/reference/search-multi), [combined filmography](https://developer.themoviedb.org/reference/person-combined-credits), [images](https://developer.themoviedb.org/docs/image-basics), [TMDB attribution](https://developer.themoviedb.org/docs/faq).
