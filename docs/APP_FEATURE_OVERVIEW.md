# Hobbyist feature overview

Status as of November 17, 2026. This describes implemented behavior in the current source code, rather than treating navigation placeholders as finished products.

## Current position

Hobbyist has a working account system and personal movie/TV tracker, catalog discovery, actor/director discovery and portfolios, detailed movie/TV statistics, custom mixed-media lists, and the Phase 4A IGDB gaming integration. New gaming/list schema activation is documented in `GAMES_PHASE4A.md`.

Books, music, projects, community, broad collections, and hobby reports still have placeholder pages. The visual foundation reaches beyond the features that currently save real data.

## Accounts and profiles

- Email/password account creation and sign-in through Supabase Auth.
- Email-confirmation handling, including PKCE callback and token-hash confirmation routes.
- Password-reset request, recovery-link handling, and authenticated password changes with confirmation.
- Sign-out, session cookie refresh, server-verified identity, and protected personal pages/actions.
- Personalized display name and initials in the app shell and home dashboard.
- Profile editing: username, display name, biography, and public/private visibility.
- Unique normalized usernames with server and database validation.
- Member-since date and profile preview link.
- Public profile route at `/u/[username]`; private profiles are unavailable to visitors.
- Profile read responses exclude account email, password, and private preferences.
- Avatar/banner references and private preference storage exist as foundations. Uploads and customization controls are not implemented; current avatars use initials.

## Navigation, layout, and loading

- Shared dark app shell with sidebar, sticky top bar, constrained centered content, and responsive layouts.
- Mobile bottom navigation and a More menu for remaining destinations.
- Sidebar and horizontal navigation highlight the current destination. Horizontal tabs distinguish query-based Watchlist and My library routes.
- Global search finds app destinations and shortcuts, with links to live movie, TV, and people searches.
- Keyboard shortcut focuses destination search; Escape dismisses it.
- Global My Lists dropdown with View lists and Create new list, plus sidebar/mobile access.
- Shared Back links with the same centered arrow, spacing, and interaction styling on detail, placeholder, error, and not-found screens.
- Slim loading indicator replaces the old six-poster loading grid throughout the app, including movie, TV, people, and list routes.
- Focus styling, accessible labels, dialog controls, status messages, and reduced-motion handling.
- Shared navigation/back components and repository conventions preserve these UI choices for future changes.
- Notification popup is currently demonstration content, not a real notification service.

## Home dashboard

- Signed-in, personalized welcome and profile shortcut.
- Five recently watched movies from the user's real library.
- Five currently watching TV shows from the user's real library.
- Quick-access destinations for movie watchlist, TV library, and other sections.
- Real Currently Playing and recently completed game cards, with progress where recorded. Other-interest cards link to future Books and Projects areas.

## Movie discovery and detail pages

- Live TMDB movie search and weekly trending discovery, with pagination.
- Five-title dashboard previews; the former lone sixth card is removed.
- Poster cards with movie title, release year, genres, TMDB score, and available description.
- Detail pages with poster, tagline, genres, release date, runtime, synopsis, TMDB score/vote count, and TMDB attribution/link.
- Cast cards link to person portfolios.
- Catalog availability, missing-image, error, and not-found handling.
- Add to list opens a picker for the user's custom lists.

## Personal movie tracking

- Independent watchlist and watched flags; a movie can belong to both.
- Quick add/remove watchlist and watched/unwatched actions.
- Optional watch date, personal rating, written review, and spoiler flag.
- Personal 0.5–5-star ratings, including half-star selection, arrow-key adjustment, and clearing a rating.
- Personal ratings remain separate from TMDB's 0–10 score.
- Saving a rating or nonblank review marks the movie watched. It does not invent a watch date.
- Watching a movie does not require a rating or review.
- Review dialog groups optional watchlist/date controls under expandable details.
- Saved reviews, spoiler indicators, and personal stars appear on the relevant screens.
- Library filters for All, Watchlist, and Watched, with pagination.
- Remove personal tracking independently of the TMDB title or custom-list entries.
- Quick changes preserve existing reviews/ratings and applicable watch dates.

## Movie statistics

- Total watched, watched this week, and watched this year.
- Watchlist count, rated-movie count, and written-review count.
- Personal average rating and five-star movie count.
- Total viewing hours from known movie runtimes.
- Favorite decade based on watched movies' release dates.
- Favorite genre plus top-five genre ranking by movies watched.
- Most-seen actors plus top-five ranking using the first ten billed cast per watched film.
- Actor links from the ranking.
- Six-month viewing activity chart.
- Distribution of personal ratings in half-star increments.
- Date-based statistics use recorded watch dates; weeks run Monday–Sunday in Mountain time.
- Undated movies and missing catalog details are acknowledged, rather than fabricating dates or metadata.
- Tracking records represent individual movie titles; repeated viewings are not a separate rewatch log.

## TV discovery and overall tracking

- Separate TV search, trending discovery, dashboard, library, and statistics pages.
- Five-show dashboard previews and real Currently watching entries.
- Show details, artwork, synopsis, genres, TMDB score, first-air date, and available season counts.
- Overall show rating, written review, spoiler flag, start date, and completion date.
- Statuses: Planned, Currently watching, Watched, Paused, Dropped, and Completed.
- TV library filters for those statuses, with pagination.
- Overall show ratings remain independent of episode ratings; episode scores are not averaged into an overall score.
- Saving an overall rating/review selects Watched, preserving an explicitly selected Completed state.
- Removing a show's tracking also removes its episode tracking, with confirmation.

## Seasons and episodes

- Season selector with artwork, episode totals, watched counts, and separate specials.
- Overall show progress and selected-season progress bars.
- Episode lists with artwork, episode numbers/titles, air dates, runtime, overview, personal stars, and watch state.
- Paginated longer seasons and dedicated episode detail pages.
- Quick watched/unwatched controls.
- Episode review dialog with independent rating, written review, spoiler flag, watched state, and optional watch date.
- Ratings/reviews imply watched; watch dates remain optional.
- Marking an episode watched, saving a watched episode, or using Watch all moves unfinished shows to Currently watching.
- This resumes Planned, Paused, Dropped, and Watched shows. Completed shows stay Completed.
- Episode changes preserve overall show ratings, reviews, and dates. Unwatching an episode does not reset show status.
- Watch all marks every listed episode in the chosen season, including episodes beyond the visible pagination page, while preserving saved episode reviews, ratings, and dates.
- Watching episodes does not automatically mark a show Completed.

## TV statistics

- Watched-episode total and episodes watched this week.
- Shows completed, shows currently watching, and specials watched.
- Total binge runtime in hours/minutes and equivalent days, from known watched-episode runtimes.
- Average episode runtime.
- Average watched episodes per show with episode activity.
- Average episodes per dated watch day.
- Biggest binge day: episode count, recorded date, and known runtime.
- Seasons started and seasons finished; finished requires every listed catalog episode to be watched. Specials are separate.
- Favorite genres ranked by shows in viewing history.
- Shared actors across multiple shows, with links to the person and the matching shows. Uses the first ten billed cast.
- Separate personal averages for shows and episodes.
- Five-star episode count and separate show/episode rating distributions.
- Six-month episode activity chart.
- Missing dates, runtimes, and catalog details do not turn into invented activity. Binge days describe dated episode totals, not measured continuous viewing sessions.

## Actors, directors, and portfolios

- Live person search and a saved/followed-people library with pagination.
- Popular browse feed based on cast/directors of popular movie/TV titles, with adult filtering and a minimum audience-vote threshold.
- People deduplicated across credits, ranked by popularity, with reserved space for directors.
- Browse cards show Actor/Director and recognizable titles.
- Follow/unfollow controls and owner-private follow data.
- Person biography, portrait, department, birth/death dates, and birthplace when available.
- Combined movie/TV acting credits and directing credits, deduplicated by title identity.
- Filmography filters for All credits, Movies, and TV shows, with pagination.
- Portfolios now sort by TMDB score descending, putting unrated titles at the bottom; vote totals and deterministic fallbacks break ties.
- Links from cast, statistics, followed people, and portfolios connect the browsing experience.

## Custom lists — implemented, hosted migration pending

- Create a custom-named list up to 100 characters; lists default to private.
- Public/private switch, editable name, and confirmed list deletion.
- Combine movies, TV shows, and games in one list.
- Add from movie/TV detail pages through a list picker, or search and add from inside a list.
- Paginated search results, list contents, and list directory.
- Duplicate protection; movie and TV titles with the same numerical TMDB ID remain distinct.
- Remove individual items without changing watch status, reviews, ratings, or other lists.
- Shareable public URLs and Copy public link.
- Signed-out read-only access to public lists; private lists remain owner-only.
- Only owners may edit metadata, add/remove titles, or delete a list, even when it is public.
- Public lists contain catalog entries only; they do not expose personal tracking data or private profile details.
- Switching back to private removes visitor access. Deleting a list removes its list entries only.

## Games ? Phase 4A

Live IGDB discovery, search, genre/platform browsing, detail pages, screenshots, developer/publisher information, related titles/DLC, and player/critic catalog scores are implemented. Personal tracking supports independent ownership, primary status, Wishlist/To Be Played/Want to Play More queues, favorites, selected platforms, manual playtime, progress, dates, half-star ratings, reviews, and spoilers. Games extend the shared list system with descriptions and reordering. Personal statistics and home gaming sections use stored data. See `GAMES_PHASE4A.md` for complete features, files, verification, hosted migration 005 activation, and Steam preparation. Steam imports are not implemented.

## Data and engineering foundation

- Next.js App Router, React, TypeScript, CSS, and Lucide icons.
- Supabase Auth and PostgreSQL persistence with row-level security and explicit column grants.
- Server Actions validate identity, ownership, fields, ratings, dates, and TMDB identities.
- Database constraints enforce key identities, valid states, rating increments, bounded reviews, date order, and list uniqueness.
- TMDB requests stay server-side, with caching, timeouts, adult filtering, catalog-error handling, and image-host restrictions.
- Personal data is read under the authenticated user's session rather than a service-role bypass.
- Personalized responses are marked private/no-store; public list visibility is enforced by database policies.
- Older `/movies-tv` URLs redirect to the separate movie, TV, and people routes; legacy tracking data remains archived.
- Migration files, profile repair SQL, setup guides, validation/action tests, local SQL/RLS regression tooling, and browser acceptance tooling are included.
- Prior movie/TV/list baseline verification: 39 Node tests, lint, TypeScript, production build, all local migration/RLS checks, and signed-out browser checks at 390px, 1440px, and 2560px pass. New-list database behavior was tested locally; hosted list activation and signed-in acceptance still require applying migration 004.

## Not implemented yet

- Books/reading progress, music/listening tracking, and projects.
- Broad multi-hobby Collections; current custom lists support movies, shows, and games.
- Real community, friends, activity feeds, notifications, likes/comments, or collaborative lists.
- Avatar/banner uploads, Top 4 favorites, Hobbyist Mosaic controls, themes, and dashboard customization.
- Cross-hobby reports, export/import, and yearly recaps.
- Rewatch/session logs, actual viewing timers, and drag-and-drop reordering. Lists now have Move up/Move down ordering.
- Public review feeds, public user-library browsing, and an indexed community list-discovery page.
- A dedicated signup-confirmation resend screen.

## Suggested next work

1. Apply Phase 4A migration 005 after the existing migrations, then verify game tracking and mixed-list lifecycles with owner, signed-out visitor, and second-account sessions in the hosted project.
2. Run a full signed-in mobile/desktop acceptance pass and production configuration check, including confirmation/recovery email delivery.
3. Add product features according to priority: profile customization, real community/public list discovery, or the next hobby category.
4. Add rewatch/session history if more accurate time-based statistics become a priority.

The main movie/TV product is substantially built. The largest remaining product areas are the other hobby categories and real social/customization features, rather than basic film/episode tracking.
