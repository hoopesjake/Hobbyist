# Calendar-first hobby cards

**Current integration:** [Unified calendar, library synchronization and historical ratings (migration 008)](unified-calendar.md) supersedes the synchronization limitations below.
This follow-up replaces the earlier separate search field/dropdown with a staged visual card and adds the calendar-to-library behavior requested afterward. It supersedes the Phase 1 restrictions on adding catalog items.

## The interaction

1. Click a day, an hourly slot, **Plan activity**, or **Log activity**. The first card offers **Link hobby** (your saved library) and **Add a new hobby** (catalog search). **Other activity** keeps custom non-catalog memories available.
2. Search by name immediately using the field above four centered category bubbles. With no category selected, Movies, TV shows, and Games are searched together. Selecting a bubble narrows the results to that library or catalog without clearing the entered name; selecting it again clears the category filter. Each icon sits inline beside its label. Saved library items are listed before typing, and search continues through older pages. Books remains a placeholder, with the search field visible but disabled and no book API or tracking writes. Arrow keys/Enter select results; Escape backs out of searching.
3. Select a result. Its cover becomes the top of the card over a softly faded cover background. The event title/category fill automatically; an existing custom event title is kept. Date, plan/log choice, private notes, Timing, TV episode selection, and People & details appear below. Changing the hobby dims and disables those details until the selection is confirmed.
4. Save once. Selecting or browsing a catalog result alone does not save anything. A new catalog item and its calendar entry are saved in one database transaction. A failed event save rolls back the library addition.

## Library behavior

| Hobby | New planned item | New actual activity |
| --- | --- | --- |
| Movie | Watchlist | Watched, with the activity's date |
| TV show | Planned | Watching |
| Game | Backlog | Playing |
| Book | Placeholder only | Placeholder only |

Actual logs also advance unfinished existing items: an unwatched movie becomes watched and leaves Watchlist, planned/paused/dropped shows become watching, backlog/paused/dropped games become playing. Existing completed/watched history, ratings, reviews, recorded dates, ownership, and manual playtime are preserved. Calendar duration is not written into manual game playtime. Notes and participants remain private calendar data and are never copied into reviews or public posts.

Editing a memory's notes/date does not repeatedly reapply library status. Changing its linked hobby can add/advance the newly linked item. Deleting or correcting a calendar entry does not delete independent library records or automatically undo their tracking status. Full bidirectional history reconciliation, aggregate playtime synchronization and episode watched-state synchronization remain separate work.

Books are intentionally deferred. The temporary book API adapter, portfolio pages, provider types, tracking tests, and draft `202611170008_calendar_books.sql` migration were removed. `/books` and `/books/reading-list` use the app's existing placeholders. The calendar retains its Books category for optional manual, unlinked notes, but the Link hobby / Add a new hobby Books choice cannot search, select a book, or create book tracking. A future full book library can supply its catalog and saved items without a separate calendar-owned book library.

No live database was altered for this removal. If the earlier draft book migration was manually applied outside this session, this change deliberately does not drop its tables or erase its data; review that schema separately when implementing the future book library. Do not apply the withdrawn draft migration.


## Migrations and rollout

**The remaining follow-up migration was not applied to hosted Supabase or production.** Review and apply pending migrations only in an isolated development environment first, in filename order:

- `202611170006_calendar.sql`: original private calendar schema (if not already applied).
- `202611170007_calendar_library.sql`: verified cover snapshots and atomic calendar-to-library creation/status updates.

With `HOBBYIST_DEV_DATABASE_URL` set explicitly to a disposable development database, and the earlier migrations already applied:

```powershell
psql "$env:HOBBYIST_DEV_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202611170007_calendar_library.sql
psql "$env:HOBBYIST_DEV_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/calendar_rls.sql
psql "$env:HOBBYIST_DEV_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/calendar_library_rls.sql
```

Do not rerun migrations already applied. No reset is needed. Production migration/deployment still requires explicit approval. Existing `.env.local`, provider credentials, personal records and earlier uncommitted work were preserved; no changes were pushed.

## Verification and limits

- ESLint, TypeScript and the production build.
- Existing media tests plus calendar domain/server-action tests.
- `npm run test:calendar:db`: applies all actual migrations to isolated in-memory PostgreSQL and checks privacy, ownership, invalid provider identities, atomic rollback, new library statuses, preservation of existing personal fields/completed history, and no anonymous/cross-owner access.
- `npm run test:calendar:ui`: headless Chrome tests the actual client components with isolated action fixtures and synthetic cover fixtures. It exercises choice → thumbnail search → selected cover → details → save → refresh, plus changing the actual hobby, views, custom slots, keyboard behavior, deletion and mobile layout. No fixture is exposed by the app. Screenshots are under `.next/calendar-verification/`.
- A live signed-in Supabase Auth/PostgREST test environment was not supplied. Hosted authenticated end-to-end verification remains pending, including checking the real watchlist/library pages after saving. Existing IGDB connectivity problems can still prevent live game catalog search; the implementation does not change Twitch/IGDB authentication.

After applying migrations in development, reproduce the requested example: open Thursday, choose Add a new hobby, select Movies, search The Hunger Games, select its cover, save a plan, refresh, then verify the same TMDB ID appears in Movies → Watchlist. Repeat with an actual past movie session (Watched), a show (Watching), and a game (Playing). Also verify Books shows only its placeholder with no search or save controls, canceling the dialog adds nothing, and another account cannot see private activity.
