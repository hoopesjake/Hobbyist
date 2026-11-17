# Phase 4A — live video games

Implemented November 17, 2026. Games use IGDB catalog identities and owner-private Supabase tracking. Existing movie/TV tracking and list URLs remain in place. No GitHub push was performed.

## Features

- Real `/games` dashboard with popular-with-players discovery (ranked by IGDB rating count), search, personal queue counts, Currently Playing, recently completed, and favorite-game previews. Previews contain up to five cards.
- `/games/discover`: live search, genre/platform filters, pagination, artwork, release year, genres, catalog player scores, and signed-in Backlog/Wishlist quick actions.
- `/games/[id]`: cover, summary, first release date, developers, publishers, available platforms, modes, franchises/collections, screenshots, related games, DLC/expansions, and IGDB link. Missing metadata stays missing or receives an explicit empty state.
- Independent IGDB player and critic scores out of 100, separate from personal Hobbyist stars out of 5.
- Reused half-star picker, saved stars, action forms, dialog styling, catalog images, active navigation, Back arrows, and slim loading indicator.
- Tracking dialog: optional primary status (Playing, Completed, Backlog, Paused, Dropped), optional ownership, multiple personal platforms, manually entered hours, optional progress percentage, start/completion/last-played dates, rating/review/spoiler flag, favorite, and three independent queue flags.
- Wishlist, To Be Played, and Want to Play More can coexist with each other and any primary status. Ownership never implies a status. Ratings/reviews do not automatically complete a game.
- Edit/clear ratings and reviews, update tracking, or remove personal tracking. Quick actions change only the requested field, preserving ratings/reviews/playtime/other flags. Removing tracking does not remove a game from custom lists.
- `/games/library`: All, all five statuses, all three queues, Favorites, and Owned filters, with pagination and optional progress on cards.
- `/games/backlog` preserves the existing navigation URL with a redirect to the real backlog filter.
- `/games/statistics`: actual library/completed/playing/backlog/queue counts, manually recorded hours, most played game, genres by library count, personal selected-platform counts, separate rating distribution, and completions by month/year. Undated completions are excluded from date charts. Missing catalog details never fabricate activity.
- Home now includes real Currently Playing and recently completed game sections; movie/TV sections remain. Global destination search links to live game search.
- Existing custom lists now support movies, shows, and games together, descriptions, owner-only Move up/Move down ordering, existing privacy controls, public links, and Add to list from game details.

## IGDB access

The credentials `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET` are read only on the server. Neither uses a `NEXT_PUBLIC_` name. Twitch application tokens are acquired through the client-credentials grant, retained in process memory until shortly before expiry, and renewed after expiry or an IGDB 401 response. Failed provider bodies and credentials are not logged.

Public catalog responses use Next.js caching: short revalidation for searches, longer for details and facets. Requests are serialized at least 300ms apart per server process, with a bounded queue, timeouts, and bounded 429/5xx retries. Search strings are escaped, IDs and filter inputs are validated, and query fragments are built only by server code. Multiple library games are fetched in batches.

IGDB artwork is constructed from validated image IDs on a fixed allowlisted host. IGDB is visibly credited in the Games layout and linked from details. Authentication, current fields, images, rate limits, and attribution were checked against [official IGDB documentation](https://api-docs.igdb.com/) and [Twitch's client credentials documentation](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow). Review IGDB's commercial-partnership terms before monetization. At larger multi-instance scale, replace the per-process limiter with a shared limiter for the application-wide quota.

## Database activation — required

The hosted project currently reports the new `game_tracking` table as missing (`PGRST205`), verified with a read-only ordinary app-key request. There is no database administrator connection in the workspace, so the hosted schema was not changed.

1. Open the project's Supabase SQL editor.
2. Ensure migrations 001–004 have already been applied. In particular, `202611160004_custom_lists.sql` supplies the shared-list tables.
3. Run **`supabase/migrations/202611170005_games.sql`** once. Do not rerun previous migrations over existing tables.
4. Restart the application if environment variables changed. Both IGDB variables were detected and live API calls passed.
5. Sign in and complete the acceptance checklist below.

The migration creates `game_tracking` with a stable row UUID, a unique `(user_id, igdb_id)` identity, owner-scoped RLS, indexes, explicit write grants, rating/date/progress/platform constraints, and protected timestamps. It adds list descriptions, a separate nullable IGDB identity, exclusive provider-identity constraints, uniqueness indexes, and ordering positions to existing list items. Existing movie/show identities, list UUIDs, visibility, items, and share URLs are preserved.

The ordering RPC is a fixed-SQL security-definer function with an explicit authenticated owner check and a row lock on the parent list. General item UPDATE privileges are not granted. Anonymous readers and non-owner users cannot reorder public lists. No service-role key is used. Public lists expose catalog entries, not private game tracking, ownership, playtime, ratings, or reviews.

## Validation and limits

- Live OAuth, search, detail retrieval, batched lookup, genres, and platform-filtered requests passed against IGDB. The smoke test searched for Elden Ring and received a real Nightreign result, then validated that result's detail identity.
- Production build, TypeScript, lint, and all **57 automated Node tests** passed, covering existing media features plus gaming validation, action behavior, catalog transport, and stored-data statistics.
- `scripts/check-supabase-sql.mjs` applies all migrations in a disposable local PGlite PostgreSQL engine and runs existing plus game RLS tests. Game tests cover independent status/ownership/queues, upsert grants, private-data isolation, invalid values, public mixed lists, duplicate protection, reordering, visibility changes, and preservation of old list/movie/TV data.
- `scripts/check-games-browser.mjs` passed in headless Edge at 390px, 1440px, and 2560px: live dashboard/search/details, genre/platform options, screenshots metadata, protected-library redirect, centered Back arrows, no horizontal overflow, and no browser JavaScript errors. Mobile and desktop screenshots were visually inspected.
- The existing movie/TV browser suite also passed at all three sizes, including half-star input, movie/show/episode forms, special seasons, actor filters, legacy redirects, and protected libraries/statistics. Its selectors were updated to match the previously implemented half-star interaction and Filmography heading. A mobile destination-search popup overflow found during regression testing was corrected. A browser-bundle scan confirmed that neither configured IGDB credential appears in shipped browser JavaScript.
- Signed-in hosted game saves, real-account refresh persistence, hosted list additions/reordering, and authenticated homepage/statistics remain unverified until migration 005 is applied and a signed-in acceptance session is available. Action tests use controlled database adapters; SQL/RLS tests use real local PostgreSQL, not the hosted project.
- No application dependencies were added. Tests reuse TypeScript and the previously installed temporary PGlite/playwright-core tooling outside the repository.

Commands:

```powershell
npm.cmd run test:media
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
node scripts/check-igdb-live.mjs
# Optional: point these variables to installed temporary tool modules.
$env:HOBBYIST_SQL_TEST_MODULE = "PATH/TO/@electric-sql/pglite"
node scripts/check-supabase-sql.mjs
$env:HOBBYIST_BROWSER_TEST_MODULE = "PATH/TO/playwright-core"
$env:HOBBYIST_TEST_URL = "http://localhost:3104"
node scripts/check-games-browser.mjs
```

Hosted acceptance: sign in → find a real game → Track game → choose status/ownership/platforms → select multiple queues → record hours/progress/dates → rate/review/spoiler → save → refresh → verify all fields → add to a mixed custom list → reorder/rename/describe/share it → test public link signed out → switch private → verify visitor denial. Then verify Movies, TV, home, and existing lists with the same account. Delete only the test tracking/list records when finished.

## Files

New application files:

- `src/lib/igdb.ts`, `igdb-transport.ts`: server-only catalog types, OAuth, caching, requests, and media helpers.
- `src/lib/games.ts`, `game-validation.ts`, `game-statistics.ts`: private reads, validation/query building, and aggregation.
- `src/lib/list-catalog.ts`, `src/components/lists/list-catalog-card.tsx`: mixed-provider list rendering.
- `src/components/games/game-card.tsx`, `game-discovery.tsx`, `game-library.tsx`, `game-review.tsx`.
- `src/app/games/layout.tsx`, `page.tsx`, `actions.ts`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `discover/page.tsx`, `library/page.tsx`, `statistics/page.tsx`, `backlog/page.tsx`, `[id]/page.tsx`.
- `supabase/migrations/202611170005_games.sql`, `supabase/tests/games_rls.sql`.
- `tests/game-validation.test.mjs`, `game-statistics.test.mjs`, `game-actions.test.mjs`, `igdb-transport.test.mjs`.
- `scripts/check-igdb-live.mjs`, `check-games-browser.mjs`.

Updated files:

- `next.config.ts`: IGDB image-host allowlist.
- `src/app/page.tsx`, `src/lib/navigation.ts`, `src/components/layout/topbar.tsx`: home gaming and discovery navigation.
- `src/lib/lists.ts`, `list-validation.ts`, `src/app/lists/actions.ts`, `[id]/page.tsx`, `src/components/lists/add-to-list.tsx`, `list-fields.tsx`: compatible game IDs, descriptions, ordering, mixed search/cards.
- `src/app/globals.css`: matching game/detail/queue/statistics/list styles.
- `scripts/check-supabase-sql.mjs`, `check-media-browser.mjs`, existing list tests, `package.json`: regression suite extensions.

## Phase 4B Steam preparation

Steam login, imports, achievements, synchronization, and mapping are intentionally not implemented. No Steam data is assumed to exist.

`game_tracking` stays keyed by one user and one stable IGDB game ID; its UUID can later anchor playthrough/session/social-review records. Manual playtime is explicitly named `manual_playtime_minutes`, so imports need not overwrite user-entered hours. Ownership and queue flags are independent of completion/progress.

Recommended Phase 4B additions: an owner-private connected-account table; an external-ID mapping keyed by provider and external game ID; separate imported-library records containing source playtime, achievements, and sync timestamps; and a source-selection policy. Resolve Steam App IDs to existing IGDB identities before merging to avoid duplicate games. Preserve manual fields. Never add two provider lifetime totals together: choose the displayed source or define a user-approved reconciliation policy. Model distinct additional sessions/playthroughs separately if they become additive.

Remaining prerequisites for Steam are its account-link flow, API/provider configuration, accessible user-library/privacy permissions, reliable App-ID mapping, and a sync-conflict policy. None blocks the manual IGDB-based game tracker.
