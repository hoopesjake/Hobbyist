# Books setup and verification

Books now uses Open Library's public search, work, edition, author and cover endpoints. No API key or Open Library login is required. This replaces the earlier Calendar Books placeholder; existing Movies, TV, Games, Calendar, ratings and photos components are reused.

## Localhost

1. Keep the existing Supabase URL and publishable key in `.env.local`.
2. Set `OPEN_LIBRARY_CONTACT_EMAIL=Hoopesjake@gmail.com` (already configured locally). Requests identify Hobbyist through a server-only User-Agent. Never use an invented address.
3. Set `NEXT_PUBLIC_SITE_URL=http://localhost:3000` and run `npm run dev`. Restart an existing development server after changing environment variables.
4. Open `/books`, search for The Way of Kings, and open the Brandon Sanderson result. Sign into Hobbyist to save it.
5. Open Library's selected English edition is preselected for new books. Existing editions and edition-specific progress are preserved. Enter page count if unavailable and save status, reading dates, progress, half-star rating, review and private notes. Refresh to confirm your own hosted account record.
6. Select Plan reading session or Log reading session. Actual logs accept date, duration, inclusive page ranges, optional rating, private notes and photos/captions. Follow the linked book from Calendar or open the session from the book's history.

## Database

The additive migration is `supabase/migrations/202611170011_books.sql`, following migrations 001–010. Apply only unapplied migrations in filename order using the Supabase SQL editor for the intended project. Do not reset a database. The user reports applying Books migration 011; the subsequent read-only hosted probe no longer reports missing relations and rejects signed-out access with permission denied. The reading-date update additionally requires `supabase/migrations/202611170012_book_reading_dates.sql`. Apply 012 once, after 011, before saving reading dates. It adds date columns and updates the existing security-invoker view; no reset is needed.

The owner-only `book_tracking` table stores personal records. The security-invoker `book_library` view derives reading progress and effective status. Calendar writes run in a transaction through `save_reading_activity`; invalid saves roll back together. Actual sessions contribute the furthest completed page for the selected edition, rather than summing overlapping page ranges. Edits and deletions recalculate progress; manual progress remains a baseline. Edition changes retain session history without importing page positions from another edition. Session ratings preserve the personal rating unless explicitly updated.

Reading lifecycle: a finish date means Finished; a start date without a finish date means Currently Reading. Finished shows the edition's complete page count when known. Books without dates or activity can remain Want to Read. Explicit dates remain manual records. Actual Calendar sessions also derive the earliest reading date and the first session reaching the final page; plans do not mark a book started or finished. Edits/deletions recalculate derived dates instead of creating duplicate records or copying stale dates into tracking. Manually entering reading dates does not fabricate timed Calendar sessions.

Library return links preserve the originating status filter and page, while search return links preserve the search and page.

## Vercel

Add `OPEN_LIBRARY_CONTACT_EMAIL` to the appropriate Vercel environment using your actual contact email. Keep the existing Supabase variables and use the deployed URL for `NEXT_PUBLIC_SITE_URL`. Ensure that the intended Supabase project has migrations 011 and 012 and their predecessors. A subsequent user-initiated deployment picks up the environment change; no deployment or push was performed here.

## Verification and limits

- Live Open Library search returned 18 results for The Way of Kings Brandon Sanderson; work OL15358691W, author, description, editions and cover were verified. The tested edition did not supply page count, so manual entry remains available.
- `npm run test:books:ui` uses the actual components and server actions against isolated PostgreSQL with owner RLS. It verifies saving, refresh, statuses, progress, ratings/reviews/notes, Calendar planning/logging/linking, edits/deletions and mobile layout. It creates no hosted account records.
- `npm run test:calendar:db` applies all migrations to isolated PostgreSQL and verifies persistence, ownership, rollback and reading progress alongside previous Calendar SQL checks.
- `npm run test:calendar`, `npm run test:media`, `npm run test:calendar:ui`, `npm run lint`, `npx tsc --noEmit`, and `npm run build` cover regressions and production compilation. `npm run test:books:live` checks the public provider.
- Authenticated writes to the user's hosted database have not been exercised by this agent: no user session is available. The signed-in save-and-refresh steps above remain the hosted acceptance check. Public localhost route checks and isolated persistence tests are distinct from that check.

Public catalog results are cached (search five minutes, details one day); private reading data is not put in shared catalog caches. Requests are serialized per server process at 400 ms intervals with a 12-second timeout and bounded retries for rate limits or temporary service failures. Multiple independently scaled server instances do not share this queue. See [Open Library API guidelines](https://openlibrary.org/developers/api).

## Reading dashboard and statistics

- `/books` is the personal reading dashboard, using the same stat cards and shelf layout as Movies, TV and Games. It previews Currently Reading, Recently Finished and Want to Read.
- `/books/discover` searches the public catalog. Existing `/books?q=...` URLs still load results.
- `/books/statistics` shows reading time, pages, completions this year/month, monthly/yearly trends, personal ratings, favorite authors and favorite genres. Shared navigation highlights each destination.
- Reading time counts actual Calendar durations only. Unknown durations are not estimated. Page ranges are merged per work/edition and combined with manual library progress and known full lengths of finished books. Overlaps, repeated request IDs, plans and future sessions do not inflate totals. Different editions remain separate.
- Dated completions use the existing effective finish date, with undated completions reported separately. Periods follow the Calendar's default America/Denver timezone.
- Genres are mapped from real Open Library subjects for finished books, fetched in cached batches of up to 50. Genre data streams separately and provider failures leave saved statistics usable.
- No additional database migration is needed for dashboards; the earlier reading-date migration 012 is still required for effective completion dates.
