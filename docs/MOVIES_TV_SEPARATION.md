# Movies, TV Shows, and episode tracking

## Setup: apply only the new migration

Authentication and the existing TMDB token stay unchanged. The read-only hosted schema check found the previous combined table, but the three new tables were not installed at implementation time. No hosted migration or authenticated write was performed.

1. Open your existing Supabase project > SQL Editor > New query.
2. Copy `supabase/migrations/202611160003_separate_movies_tv.sql` in full.
3. Run it once, after the already-applied profile and TMDB migrations (001 and 002). Do not rerun 001 or 002.
4. Restart `npm run dev` and sign in.
5. Open `/movies` and `/tv`, then verify the saved-data checks below.

The migration is transactional and additive: new tables/indexes/policies/functions, a one-time copy, and read-only permissions for the old archive. It does not drop tables, delete records, or change authentication, profiles, preferences, or actor follows. A conflicting existing schema name causes rollback; review the error rather than dropping anything. In a linked CLI workflow, review `supabase db push --dry-run` before applying; reconcile migration history if earlier migrations were applied manually.

## Separate routes and behavior

**Movies**

- `/movies`: movie dashboard with personal statistics, recently watched films, and movie discovery.
- `/movies/discover`: movie-only trending/search.
- `/movies/library`: separate All, Watchlist, and Watched filters; `/movies/watchlist` and `/movies/watched` are convenient aliases.
- `/movies/[id]`: movie details/cast, optional coral Review dialog, quick watchlist and watched toggles.
- `/movies/statistics`: movie-only watched/watchlist/rated counts and personal average rating.

A movie has independent watchlist and watched flags, one optional primary watch date, one overall 0.5-5 rating, optional review, and spoiler flag. It has no watching, paused, start, finish, or episode progress fields. Marking watched does not force a rating or review. The quick buttons preserve existing reviews/ratings. A movie may be in both lists until the owner removes its watchlist flag. A future rewatch-log table can reference the existing movie identity without replacing this primary record.

**TV Shows**

- `/tv`: TV dashboard, current shows, and TV-only discovery.
- `/tv/discover`: TV-only trending/search.
- `/tv/library`: Planned, Currently watching, Watched, Paused, Dropped, and Completed filters.
- `/tv/[id]`: overall show review/status/dates plus selectable seasons and inline episode controls.
- `/tv/[id]?season=0#seasons`: TMDB specials where available.
- `/tv/[id]/season/[season]/episode/[episode]`: full episode description, artwork, air date/runtime, catalog score, and independent personal tracking.
- `/tv/statistics`: TV counts, overall-show personal average, and total watched episodes (including specials).

Episode controls work from the season list: mark watched/unwatched with one button, or open Review episode to edit its rating, review/spoiler flag, watch state, and watch date without navigating away. Longer seasons are paginated. A rating is optional when marking watched; an episode can be rated without being watched or rating other episodes.

Watching an episode creates its parent show if absent and moves an unfinished show to Currently watching. Completed shows keep their status; overall dates, ratings, and reviews are preserved. Overall start/completion dates, status, and rating are edited only in the overall show dialog. No episode rating is averaged into a show rating. No completion status or watch date is assigned automatically. Quick watched toggles leave dates blank unless an existing date is available; owners can record dates in the dialog. Unmarking watched clears its watch date, while retaining its review and rating.

Show progress counts unique watched episode records against TMDB's listed main-season episode counts, including announced episodes in the denominator. Season 0 is available and tracked but excluded from the main-show progress percentage, explicitly labeled in the UI. Selected-season progress uses actual episode entries. A caught-up ongoing show is never automatically completed. Status Watched means the owner has seen it but has not explicitly marked it Completed; the status is always the owner's choice.

**Actors**

- `/actors`: existing private followed actors, preserving existing follow rows.
- `/actors/discover`: person search and discovery.
- `/actors/[id]`: combined acting filmography with All credits, Movies, and TV shows filters. Credits link to `/movies/[id]` or `/tv/[id]` correctly. Follow/unfollow still uses the existing table and RLS.

Old `/movies-tv` catalog/detail/actor links redirect to the corresponding separate sections. The old mixed watchlist links to the movie watchlist; the TV library is separately available from navigation. Legacy tracking actions refuse new writes and ask old tabs to refresh.

## Migration preservation and security

`movie_tracking` stores movie personal data. `tv_tracking` stores overall-show personal data. `tv_episode_tracking` stores independent personal episode data, keyed by owner/show/season/episode, with a unique owner/TMDB-episode-ID constraint. Season 0 is valid. Episode rows reference their owner's show row. Explicitly removing a show asks for confirmation and removes its owned episode records; removing an episode leaves its show intact.

External names/posters/descriptions stay in the shared server-only TMDB cache and are hydrated for library cards. They are not duplicated into the new personal tables. A TMDB failure displays a clearly labeled catalog-unavailable fallback, not invented titles or missing personal state.

Legacy mapping:

| Old combined entry | New active record |
| --- | --- |
| Movie Completed | `watched=true`; original date/rating retained |
| Movie Watchlist/Watching/Paused/Dropped | `on_watchlist=true`; original rating retained; if a watch date exists, also watched |
| TV Watchlist | Planned show |
| Other TV status | Same show status |
| TV start/watch dates | Overall show start/completion dates |

All old rows, IDs, timestamps, original statuses/start dates, catalog snapshots, and `viewing_events` remain in the original tables as an owner-readable archive. Old movie start/progress fields are not carried into the new movie UI. Existing episode history cannot be inferred from a legacy Completed show, so the migration invents no watched episodes. A legacy show can remain Completed with zero recorded episodes until the owner fills in their history. The retained archive is not a second active source of ratings/reviews; only the new domain tables are used for personal tracking.

All three new tables have RLS and explicit owner-only CRUD privileges. Anonymous access is revoked. Owner and stable identity fields cannot be changed; creation/update timestamps cannot be client-assigned. Ratings, date order, future dates (UTC server day), review length, watched/date consistency, and episode keys are validated in the database as well as the application. Statistics run through a security-invoker function under the caller's RLS. All reviews and spoiler flags remain private; React renders review text as escaped text. Public profile visibility does not expose tracking records.

The original combined table's client writes are revoked to prevent divergent data from old browser tabs; SELECT remains under its original owner-only RLS. This migration does not remove the table or its audit history. Reverting to the old application would require an intentional data reconciliation/permission plan, rather than simply redeploying an old build.

## Layout and homepage

The main content uses a centered 1280px maximum width inside the sidebar's available area and balanced responsive padding. Account forms are centered. Review dialogs explicitly use fixed insets and automatic margins; substantial content is not positioned using notification/popover rules. The notification panel's negative right offset was removed, its trigger wrapper now sizes to its button, and mobile search results remain within the viewport while anchored to search. Lightweight menus remain anchored.

The authenticated homepage has separate Recently watched movies and Currently watching TV shows sections from the new personal tables. Unconnected games/books/projects have honest empty states rather than fictional personal media/progress. No other integration was added or redesigned. Existing sidebar, mobile navigation, typography, coral accent, search, and profile/auth functionality are preserved.

## What was tested

- Lint and a production build, including TypeScript.
- Live TMDB movie/TV discovery, movie/show details, season 1/2 and season 0 specials, episode metadata/artwork, and actor filmography filters.
- Eleven Node validation tests across the legacy validator and new movie/show/episode rules, including ratings/dates, movie-only fields, optional independent episode ratings, specials, and actual watched-key progress.
- Both previous SQL migrations/tests plus the new migration/test ran in a disposable local PGlite PostgreSQL-compatible engine. The harness populated legacy records first and verified their preservation and mapping.
- SQL tests checked movie partial updates, review/spoiler persistence, owner reads/updates/removals, episode changes preserving overall show values, explicit completion-date independence, special episodes, optional episode ratings, statistics, immutable identity, invalid dates/ratings/review sizes, cross-user denial, anonymous denial, and frozen legacy writes.
- Headless Edge acceptance at 390px, 1440px, and 2560px checked separate forms, movie absence of TV progress fields, episode dates/reviews/spoilers, half stars, season/special/episode navigation, actor filters, old redirects, protected libraries/statistics, centered content/dialogs, anchored notifications/search, and absence of horizontal overflow/browser JavaScript errors.

The local SQL engine is not the hosted Supabase Auth/PostgREST service. Authenticated hosted saves and refresh/sign-out/sign-in persistence could not be tested without applying the new migration and using an account. The browser checks use fresh signed-out sessions; no real credentials or browser sessions were read. No hosted data was modified and nothing was pushed to GitHub.

## Repeat checks

```powershell
npm run lint
npm run test:media
npm run build
```

The optional SQL harness still uses the temporary PGlite installation documented in `TMDB_SETUP.md`:

```powershell
$env:HOBBYIST_SQL_TEST_MODULE = "$env:TEMP\hobbyist-tmdb-sql-check\node_modules\@electric-sql\pglite"
node scripts/check-supabase-sql.mjs
```

`supabase/tests/separate_tracking_rls.sql` can instead be run as postgres in a disposable/local Supabase database with all migrations applied; its fixtures are rolled back. Use a test project because external auth hooks could have side effects.

For browser checks, install `playwright-core` temporarily outside the app dependency tree (if needed) and run against a server on port 3101:

```powershell
npm install --prefix "$env:TEMP\hobbyist-tmdb-browser-check" --no-save --package-lock=false playwright-core
$env:HOBBYIST_BROWSER_TEST_MODULE = "$env:TEMP\hobbyist-tmdb-browser-check\node_modules\playwright-core"
# In a separate terminal: npm run start -- --port 3101
node scripts/check-media-browser.mjs
```

The browser harness uses a fresh headless Microsoft Edge profile on Windows; `HOBBYIST_TEST_URL` can override the server URL. Node tests require native TypeScript support (tested on Node 24).

## Manual saved-data acceptance after applying migration 003

1. Confirm your old movie/TV ratings and dates migrated and your actor follows/profile still work.
2. Movie: add to watchlist without reviewing; mark watched; add a primary watched date, rating, review, and spoiler flag. Refresh and sign out/in. Verify movie-only Watchlist/Watched libraries and statistics.
3. TV: set overall rating/status/start/completion dates. In a season, watch an episode without rating it, and rate a different episode without marking it watched. Edit an episode watch date independently, then refresh.
4. Confirm show rating/status/start/completion dates are unchanged by every episode edit. Confirm progress follows watched episodes but never completes an ongoing show automatically.
5. Test a season-0 special, movie/TV actor filmography filters, and correct detail links.
6. Use another account to verify that libraries, episode records, reviews, spoiler flags, and statistics remain private even if the first account has a public profile.
7. Edit/remove movie and episode records. Explicitly removing a show should prompt before removing all of its personal episode tracking.

Official TMDB references: [season details](https://developer.themoviedb.org/reference/tv-season-details), [episode details](https://developer.themoviedb.org/reference/tv-episode-details), [combined person credits](https://developer.themoviedb.org/reference/person-combined-credits).

## Review implies watched

Saving a personal rating or nonblank written review now marks that movie or episode watched. Saving an overall show rating/review selects Watched, preserving Completed if explicitly selected. Dates remain unchanged/optional and no other episode is marked watched. Marking watched without a rating or review still works. Clearing a review alone does not undo a saved watched flag; use the existing unwatched controls explicitly. This is applied by server actions on future saves and needs no schema migration or historical data rewrite.

## Season Watch all

Each selected season has a signed-in Watch all button above its episode list. It saves every listed episode in that season, including episodes on other pagination pages, with one owner-scoped bulk upsert. Existing ratings, reviews, spoiler flags, and watch dates are preserved; new dates/ratings/reviews are not invented. Unfinished shows move to Currently watching; Completed shows keep their status. Overall dates and ratings stay unchanged. Specials work when season 0 is selected. No schema migration is required. The local SQL regression test covers mixed existing/new episode rows and preservation of other seasons and overall show values.


## Automatic Currently watching

Saving a watched episode (including a rating/review), marking an episode watched, or using Watch all on a season sets the owner's unfinished show to Currently watching. This resumes Planned, Paused, Dropped, and Watched shows while preserving Completed. Unwatching an episode does not reset show status. Only status changes; overall reviews, ratings, and dates remain intact. This applies on future saves and requires no schema migration.
