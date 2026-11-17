# Unified calendar, libraries, journal and ratings

This is the current integration guide. It supersedes the synchronization restrictions in the earlier Phase 1 and visual hobby-card documents.

Latest follow-up: [private activity photos and on-page media actions (migration 009)](activity-photos.md). This supersedes the detail-page action navigation described below.

## Implemented workflows

- Movie, show, episode and game detail pages have reusable Upcoming Plans and Activity History/Recent Sessions sections. Actions open the calendar with a stable provider identity selected; the user chooses the date/time. Episode actions carry show, season and episode identity.
- Personal movie/TV/game library cards have Plan to Watch/Plan Gaming Session actions and subtle links to real upcoming events. These also appear in the homepage's currently enjoying library previews. Scheduling never supplies a watched date or rating.
- Actual movie logs mark the linked movie watched, leave Watchlist, preserve the primary original viewing date, and optionally update its existing rating/review. Rewatches remain distinct calendar sessions. Changed plans can point at a different actual hobby without giving the planned game any actual hours.
- TV sessions support up to 100 selected episodes, including multiple seasons and specials. Each has an independent optional half-star rating. Saving updates existing episode tracking atomically; current overall show ratings stay independent and shows are never automatically completed.
- Game session totals are derived from actual calendar rows. Editing 120 minutes to 180 yields 180, not 300. Deleting removes that contribution. Manual lifetime time and completed statuses remain independent; no Steam import or inferred lifetime playtime is introduced.
- Existing movie/episode controls with an explicit watched date create/update one linked calendar record. Rating-only, watchlist-only, undated watched/status changes and season actions without dates do not invent sessions. Migration backfill covers existing known dated viewings, not unknown dates.
- Journal search covers titles, linked titles, private notes and participants; filters support category and linked hobby. Full history spans all stored dates, while normal calendar period views remain available.
- The homepage retains Upcoming Plans, Recent Memories, currently enjoying libraries, and Plan/Log/Open Calendar/View Journal actions.
- Covers, hover/focus previews, temporary save feedback, privacy defaults and the staged hobby card remain intact. Each editor has a View Linked Media action.
- Saved game linking and personal activity remain usable independently of live IGDB retrieval. Saved game detail pages fall back to saved identity/artwork if the provider is unavailable; catalog search/metadata may still be unavailable. No credentials or network restrictions were changed.

## Data architecture

The existing `calendar_entries` table remains the source for both planned and actual activities (`kind`), with same-owner `plan_id` linking outcomes to their original plans. A session links to the existing provider ID, not a title match. No replacement movie/game/watch-history table is introduced.

Migration **202611170008_unified_activity.sql**, after **001-007**, adds:

- Optional `calendar_entries.session_rating`: the opinion explicitly saved for that session, using the existing 0.5-5 half-star scale.
- `calendar_entries.episodes`: a bounded, validated JSON array of stable episode identities and optional historical session ratings. One session can include many episodes. New episode identities are verified server-side, using saved episode tracking when available before live TMDB. Existing historical episode identities remain editable during catalog outages.
- `source_key`: a unique per-owner origin for dated movie/episode records created from library tracking. It prevents refresh/rating edits from making duplicate viewings.
- Nullable `watched_activity_id` references on existing movie and episode tracking, with composite owner foreign keys. These identify primary dates supplied by calendar sessions. Correcting such a session corrects its primary date. Existing/manual dates are preserved; an explicit library date edit relinquishes calendar date ownership. Relinking/removing an episode detaches its date ownership. Session deletion clears the reference but preserves independently useful watched/rating/review history.
- `save_calendar_activity`: a security-invoker, authenticated RPC that saves the session, selected episode progress, explicit rating changes and optional review in one transaction. Owner RLS still applies. Stale timestamps reject conflicting edits. Failed child writes roll back the complete save.
- Transactional triggers for actual progress and dated library activity; all new trigger functions use an empty search path. Private rows never enter shared Next.js caches.

The primary movie/episode watched date represents its original explicitly recorded viewing, not the latest rewatch or a computed minimum. Individual sessions supply the complete chronology. Deleting or relinking a session does not erase independent tracking, public-review fields, or manually entered values. Primary tracking can be edited explicitly through its existing library controls.

### Rating rules

Current overall ratings stay in `movie_tracking`, `tv_tracking`, `tv_episode_tracking` and `game_tracking`. They are loaded whenever an activity editor opens. The calendar shows the existing library rating by default, including on plans. If an actual viewing has an explicitly saved historical snapshot, that snapshot takes precedence when reopened; a different current library rating is shown separately. An untouched inherited rating is not saved as a historical snapshot.

Session ratings are optional historical snapshots. Changing the current library rating never rewrites them. Blank untouched rating inputs preserve existing values; clearing a session rating does not erase its current library rating. Current rating updates require the corresponding checkbox and an explicit rating edit. For existing sessions and new retrospective sessions earlier than known later activity, those checkboxes default off. Users can explicitly opt in when they intend to change their current opinion. Episode ratings follow the same rules independently of the overall show rating.

Reviews use existing tracking fields and spoiler flags. Private `notes` never become a review; a review changes only after an explicit edit. No new publishing or social system is introduced.

## Manual Supabase actions

No migration has been applied to hosted Supabase automatically.

1. Review the migration and use a separate development project/database first. Take the usual backup before a hosted rollout.
2. Check the database migration history. Apply only missing files in filename order: 001-005 are the existing schema, 006 adds Calendar, 007 adds calendar-first linking, and 008 adds this integration. Do not rerun old migrations, reset the database, or use the withdrawn draft book migration.
3. If 001-007 are already applied, apply only `supabase/migrations/202611170008_unified_activity.sql`, as one transaction, in the development project's SQL editor or the repository's normal migration process.
4. Reload the local app against that development project. Follow the acceptance checklist below, then approve a separate hosted rollout. Deploy the matching application code with the migration; the new save action requires the new RPC.
5. Keep the existing Supabase URL/key and TMDB/IGDB credentials unchanged. No new API key or service-role key is required.

The old draft `202611170008_calendar_books.sql` was withdrawn in the prior phase. This migration has a different name and purpose. If that withdrawn draft was manually run in any environment, inspect its migration history before applying anything; do not delete book data or assume the two files are interchangeable.

## Verification

Automated checks:

```sh
npm run lint
npx tsc --noEmit
npm run build
npm run test:calendar
npm run test:media
npm run test:calendar:db
npm run test:calendar:ui
```

The database runner uses isolated PGlite PostgreSQL, installs all eight real migrations, verifies a pre-008 data upgrade, then runs rollback-only SQL acceptance and privacy tests. It never connects to hosted Supabase or uses production credentials. The UI runner uses the real calendar components and compiled production CSS with isolated action fixtures. Run it after the production build, not concurrently: the build replaces `.next`, where verification screenshots are written. Temporary verification tools remain in ignored `node_modules/.cache/calendar-tools`; they add no production dependency.

In restricted Windows environments where Node's test subprocesses are blocked, the same suites can run with `node --test --test-isolation=none` and the file lists from package.json.

| Acceptance workflow | Automated evidence |
| --- | --- |
| Schedule a movie, keep Watchlist/unwatched, link exact provider/event | PostgreSQL transaction tests; rendered library/detail action links |
| Complete plan with rating/review/private memory, no duplicate viewing | PostgreSQL tests and browser movie form/save/reload |
| Create/link existing hobby from Calendar | Browser staged library selection and persistence; owner validation tests |
| Two TV episodes with independent ratings and show progress | PostgreSQL tests and browser two-episode form/save/reload |
| Fortnite session vs Cyberpunk plan, edited/deleted totals | PostgreSQL tests and rendered actual-only game totals |
| Approximate retrospective duration, dates, time zones/DST | Domain, database and browser tests |
| Rewatches and later current-rating changes preserve old snapshots | Movie and episode PostgreSQL tests; browser reopen |
| Historical rating edit leaves newer overall opinion intact | PostgreSQL tests and browser default-off control |
| Dated library changes appear once in Calendar | Movie/episode trigger tests; primary-date correction tests |
| Migration preserves existing data and avoids fake historical ratings | Seeded pre-008 upgrade test |
| Private rows cannot be read/changed by another owner | Real RLS and authenticated RPC tests |
| Desktop/mobile/wide-screen staged dialogs | Browser checks at 390, 1440 and 1920 px with screenshots |
| Existing movie/TV/game/list validation and statistics | Existing 63 media tests |

Hosted authentication sign-out/sign-in persistence, actual TMDB/IGDB network behavior, and authenticated live-page integration must still be checked against a separately migrated Supabase development project. Fixture tests do not constitute a hosted end-to-end verification. Database transactions, migrations and RLS have been exercised locally with real PostgreSQL behavior.

## Local development acceptance checklist

1. From Movie Watchlist, click Plan to Watch, select an exact date/time, save; verify upcoming indicators and no watched date/rating.
2. Open that plan, Log What Actually Happened, enter rating, separate review and private memory; verify one viewing, completed plan, movie watched/date/rating and links from both pages.
3. Log a later rewatch with a different rating, reopen the original, then edit its historical rating with Update Current unchecked. Verify both snapshots and the current movie rating.
4. From a show or episode page, log two episodes with different ratings. Verify their watched dates, progress and detail ratings; verify the show rating is unchanged.
5. Plan Cyberpunk and log Fortnite instead. Verify only Fortnite has actual session time; edit/delete its session and verify totals with manual hours preserved.
6. Enter a known watched date through existing movie/episode controls. Verify one calendar record; change only the rating and verify no new session.
7. Test cross-owner privacy, reload, sign out/in, and verify movie reviews/spoilers, statistics, profiles, lists and authentication.
8. Repeat key dialogs on mobile, desktop and wide screens, including journal filters and links back to media/events.

## Scope kept open

Books stays a disabled linking placeholder; music, LEGO and project library integrations remain future work. Existing manual categories/notes remain usable. No book mini-library, social invitations, new publishing model, replay UI, Steam import, or invented progress is added. The session architecture can be extended with stable library identities and category-specific payloads later.

## Files in this implementation

- Migration: `supabase/migrations/202611170008_unified_activity.sql`.
- Database verification: `supabase/tests/unified_activity*.sql`, `scripts/test-calendar-db.mjs`.
- Shared activity data/validation/artwork: `src/lib/media-activity.ts`, `activity-validation.ts`, `activity-artwork.ts`, plus `calendar.ts` and `calendar-domain.ts`.
- Calendar server page/actions: `src/app/calendar/page.tsx`, `actions.ts`, `activity-actions.ts`.
- Calendar UI: `src/components/calendar/activity-details.tsx`, `media-activity.tsx`, `calendar-editor.tsx`, `calendar-client.tsx`, `calendar-preview.tsx`.
- Media integration: `src/components/media/title-page.tsx`, `personal-library.tsx`, `src/components/games/game-library.tsx`, `src/app/games/[id]/page.tsx`, `src/app/tv/[id]/season/[season]/episode/[episode]/page.tsx`.
- Shared rating/CSS: `src/components/movies/star-rating.tsx`, `src/app/globals.css`.
- Tests: `tests/activity-validation.test.mjs`, `media-activity.test.mjs`, updated `calendar-actions.test.mjs`, `scripts/test-calendar-ui.mjs`, `package.json`.
- Guides: this file, README, and earlier calendar guide notices.
