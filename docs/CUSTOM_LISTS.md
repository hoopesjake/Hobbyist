# Custom movie and TV lists

Implemented routes: `/lists`, `/lists/new`, and `/lists/[id]`.

The global top-right **My Lists** menu offers View lists and Create new list. Lists also appear in the sidebar, mobile More menu, and destination search. Owners can create named lists, rename them, switch between private and public, add movies and TV shows, remove individual titles, and delete lists with confirmation. Lists support both kinds of titles together and reject duplicate entries. Removing a list never removes tracking data.

Owners can search the TMDB catalog inside a list, or use Add to list on movie/TV detail pages. Search results and list contents are paginated. Public lists offer Copy public link and can be opened by signed-out visitors. Private lists return unavailable to other users. Public lists expose only their name, visibility, dates, and catalog entries; personal ratings, reviews, spoiler flags, watch dates, and account preferences are never selected.

## Database activation

Apply `supabase/migrations/202611160004_custom_lists.sql` once in the Supabase SQL editor, after migrations 001–003. It creates `media_lists`, `media_list_items`, indexes, grants, owner write policies, visibility read policies, and an update timestamp trigger. The migration runs in a transaction and does not rewrite existing tracking data.

This workspace contains the application's publishable Supabase key, but no database administrator connection or linked Supabase CLI. The migration has therefore been prepared for application to the hosted project; the application key cannot create tables. Until it is applied, list screens show an availability error.

Public/private sharing is independent of profile visibility. Switching a list back to private immediately removes anonymous/visitor database access. Existing catalog information already viewed by a visitor cannot be recalled.

## Verification

- `npm run test:media`: validation, owner-only action behavior, mixed movie/TV identities, duplicate handling, and existing media regressions.
- `npm run lint` and `npm run build`: app checks.
- `scripts/check-supabase-sql.mjs`: applies all migrations and runs SQL/RLS regressions in an optional local PGlite database, including `supabase/tests/custom_lists_rls.sql`. No hosted project is modified. Set `HOBBYIST_SQL_TEST_MODULE` to the installed `@electric-sql/pglite` module path.
- The SQL test covers private/public reads as owner, another user, and anonymous visitor; forged owners; unauthorized list/item changes; public-to-private transitions; duplicate entries; invalid kinds; name validation; immutable owner identity; and cascade deletion.

Verified locally: all 39 Node tests, lint, TypeScript, production build, and the complete PGlite migration/RLS suite passed. Headless Edge checks at 390px, 1440px, and 2560px passed for the My Lists menu, signed-out creation redirect, portfolio ordering, active tabs, centered Back arrows, five-card previews, and absence of horizontal overflow/browser errors. Signed-in hosted list acceptance remains pending migration activation.

Manual hosted acceptance after activation: create a private list, add one movie and one show, rename it, remove a title, switch it public and open its link signed out, then switch it private and verify that the signed-out link is unavailable. Delete the list and verify that the underlying movie/show tracking remains intact.
