# Calendar & Memory Journal — Phase 1

**Current integration:** [Unified calendar, library synchronization and historical ratings (migration 008)](unified-calendar.md) supersedes the synchronization limitations below.
**Latest follow-up:** [Visual hobby cards, type-first library linking, automatic tracking defaults, and migration 007](calendar-hobby-flow.md). Books remains a placeholder for the future full book library; the temporary book integration and its draft migration were withdrawn.

## Delivered

The current activity form starts with **Link hobby** or **Add a new hobby**, then shows cover thumbnails as you search. Selecting a result reveals a cover card and the event details. See the follow-up guide above for the current synchronization and book behavior; this document retains the original Phase 1 architecture and rollout background.

- `/calendar`: month grid, seven-day hourly schedule, detailed day view, and month-by-month agenda/journal. URL-based view/date navigation survives refreshes and preserves the selected date. Monday starts the week. Date navigation and historical logging support 1900–2199.
- Calendar appears immediately after Home in the sidebar and directly in mobile navigation. Existing destinations remain available.
- Create, read, edit, and delete plans and actual activity logs. Day cells and hourly slots open a centered, keyboard-accessible activity dialog. Unknown times remain unknown; duration-only and approximate entries are supported.
- Eight categories, optional start/end times, overnight sessions, elapsed duration, participants, editable private notes, and fixed private visibility. No notes become reviews or social posts.
- Plans have planned, changed, completed, skipped, and canceled statuses. “Log what actually happened” creates an associated actual log that can have a different title, category, date, duration, or media item. The original plan survives. A database uniqueness constraint permits one actual log per plan; later changes edit that log. Inserting the log completes the plan in the same transaction.
- Deleting a plan preserves its actual log and notes, removing only the association. Deleting a log does not automatically reopen a completed plan; the owner can change the plan status explicitly.
- Only actual logs contribute to the calendar's logged-duration summary. Unknown durations add no invented minutes. These summaries cover the activities visible in the selected period, including the month grid's adjacent dates and the full duration of overlapping multi-day sessions.
- Movie, TV, and game library links persist typed provider IDs and a title snapshot. The dialog starts with a combined library picker for saved movies, TV shows, and games; selecting an item fills its category and suggests its title without overwriting a custom event title. Activities without a library item still allow manual categories. The picker pages through the owner's existing library; catalog outages fall back to a provider ID label. Changing a link edits the same activity. TV season/episode links, including season 0, are verified through TMDB before saving a new episode reference. Untracking a library item preserves historical calendar associations.
- Homepage preview: today's/upcoming plans over the next 90 days, three recently logged activities/memories, and quick plan/log actions. No fictional activity is displayed in the application.
- Owner-scoped reads and writes, RLS, column privileges, validation, optimistic concurrency for edits/deletes, generic errors, loading states, and responsive layouts.

## Data model and existing integrations

The inspected branch was `feature/hobby-calendar`. Existing uncommitted rendering/search/navigation changes were retained.

Existing active library tables are `movie_tracking` (TMDB movie IDs), `tv_tracking` (TMDB show IDs), `tv_episode_tracking` (show/season/episode keys and TMDB episode IDs), and `game_tracking` (IGDB IDs). The older `viewing_entries` table is an archive; it is not a calendar integration target. `profiles` and `user_preferences` remain unchanged.

Migration `supabase/migrations/202611170006_calendar.sql` adds `calendar_entries`. Its immutable `kind` distinguishes plans from actual sessions; actual rows optionally reference a same-owner plan with a composite foreign key. Notes/participants are private columns on the same protected row. No existing tables are altered or existing tracking rows rewritten. No service-role key is used.

Media references intentionally have no cascading foreign key to personal tracking tables: removing a title from a library must not erase a memory. The server and database validate ownership of newly linked library items. Provider/type/category constraints prevent mixing a movie, TV show, and game with the same numeric ID. Indexed owner/date, actual-date, media, and plan keys support later session-history and synchronization work.

## Time handling

The calendar defaults to `America/Denver`. Every record stores its own IANA time zone, original local date/time, and explicit UTC instants for known times. Dates are grouped by their recorded local date; this deliberately preserves the date a memory happened rather than moving date-only memories between zones. Timed cards include the record's time zone in day/agenda details. Use the dialog's Timing section to choose another IANA zone. A calendar URL can also set `tz` for new entries and Today navigation.

Duration is computed from UTC instants when start and end are supplied, so overnight sessions and DST changes use actual elapsed time. A nonexistent spring-forward time is rejected. A repeated fall-back time requires choosing its first or second occurrence under Timing. Existing records preserve their occurrence. Tests include one-hour and half-hour DST transitions and a quarter-hour-offset zone.

The database verifies that wall dates/times match their stored UTC instants and rejects future actual activity. Date-only and duration-only logs retain null instants. Calendar reads are request-scoped; private activity is never stored in a shared `use cache` scope. Existing Suspense/request boundaries and partial prerendering remain enabled.

## Safely apply the migration

**No migration has been applied to the connected Supabase project or production.** The migration was executed and tested only in an isolated, in-memory PostgreSQL engine. Review migration 006 before applying it to an isolated Supabase development project. Do not reset or test against production.

1. Create or identify a disposable Supabase development project/local stack. Confirm its project reference/connection string is different from production. Use a development account and fixtures, not personal production data.
2. If it is a fresh environment, apply repository migrations 001–006 in filename order. If 001–005 are already applied, apply only `202611170006_calendar.sql`.
3. With `psql` installed and `HOBBYIST_DEV_DATABASE_URL` explicitly set to the isolated environment, run in PowerShell:

   ```powershell
   psql "$env:HOBBYIST_DEV_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202611170006_calendar.sql
   psql "$env:HOBBYIST_DEV_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/calendar_rls.sql
   ```

   The SQL test creates disposable auth fixtures and wraps all changes in a rollback. It still must not run against production. Alternatively, apply the migration through the development project's SQL editor, then run the test there.
4. Point the local app at that isolated project's normal publishable credentials, sign in as a development user, and run `npm run dev`. Existing `.env.local` and provider credentials were not changed by this implementation.
5. Complete the live checklist below before considering a separately approved production migration/deployment. Migration 006 is additive but still needs review and explicit production rollout approval. There is no automatic deployment or Git push.

## Verification

Standard checks:

```powershell
npm run lint
npx tsc --noEmit
npm run build
npm run test:media
npm run test:calendar
```

Temporary optional tools for isolated SQL and browser tests are installed in ignored `node_modules/.cache`, without changing application dependencies or the lockfile:

```powershell
npm install --prefix node_modules/.cache/calendar-tools --no-save --package-lock=false @electric-sql/pglite playwright-core esbuild
npm run test:calendar:db
# Browser harness requires a production build's compiled styles and local Chrome:
npm run test:calendar:ui
```

The SQL runner boots in-memory PostgreSQL with a minimal Supabase-compatible auth schema/roles, applies all six actual migrations, and executes `supabase/tests/calendar_rls.sql`. It has no connection string and cannot contact a hosted database. It checks private ownership, anonymous access denial, forged ownership/plan associations, create/read/update/delete, media integrity, no tracking synchronization, duplicate prevention, elapsed DST duration, private notes, and preserving actual notes after plan deletion. It validates PostgreSQL behavior, not the hosted Supabase Auth/PostgREST deployment.

The browser runner bundles the real Calendar client/editor/navigation components with explicit isolated action fixtures. Chrome checks create → refresh → edit, changing a media link while logging an actual outcome, preserved plan associations, journal previews, all four views, hourly slot selection, selected-date preservation, deletion, Escape dismissal, and a 390px dialog/viewport. Fixture storage exists only in that temporary browser context and is never used by the app. Screenshots are written to `.next/calendar-verification/` (a later build may clear them). Override `CALENDAR_CHROME` for another Chromium executable. The unit action tests exercise the actual server action code with owner-scoped database doubles; the SQL tests exercise the real migration/RLS separately.

### Live Supabase checklist still required

An isolated hosted/local Supabase Auth + PostgREST environment and signed-in test sessions were not supplied, so live authenticated end-to-end verification against Supabase is pending. No production account/data was used for writes. After applying 006 in development:

1. Sign in as user A; create a future gaming plan and a movie night. Refresh; edit and refresh again.
2. Navigate to a past date; log a date-only activity with approximate duration, notes, and participants. Refresh and reopen it.
3. Link an existing library item; change the link and confirm the same activity ID remains. Verify a TV season/episode link.
4. Open a plan and log a different actual activity. Verify the original plan remains, the actual is linked, and reopening the plan opens the existing log. Confirm planned minutes do not increase logged minutes.
5. Sign in as user B and confirm A's entries/notes cannot be read or edited. Run the RLS SQL test in that development database.
6. Test all views/date navigation, hourly slot selection, mobile layout, note deletion, activity deletion, and deleting a plan while retaining its memory.
7. Confirm Movies, TV, Games, profiles, sign-in/out, library tracking, and homepage sections still work. Confirm no watched dates, ratings, reviews, or game playtime changed through calendar actions.

## Calendar library evaluation

[FullCalendar's React integration](https://fullcalendar.io/docs/react) supports Next.js and supplies established calendar views. It was evaluated but not added: Phase 1 has no drag/drop, recurrence engine, resource scheduling, or external synchronization requirement, and the existing app uses native React/CSS components. A focused CSS-grid schedule plus native modal dialogs fits the shared design system, preserves the special plan/actual and date-only semantics, and adds no production dependencies. The data model is independent of the view implementation if a later phase needs FullCalendar.

## Intentionally deferred

Bidirectional synchronization with watched dates, TV tracking and game session/playtime history; external calendar synchronization; invitations/social sharing; release imports; recurrence rules; notifications; Replay; and real Books/Music library integrations. Books, Music, LEGO and Projects can be planned/logged as categories now, but do not claim an unimplemented catalog integration. Notes remain private even if a linked profile or media list is public.
