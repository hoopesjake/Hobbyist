# Hobbyist
Hobby tracking web app

## Calendar & Memory Journal

The [activity photo and media-page action guide](docs/activity-photos.md) covers private camera-roll/camera photos, on-page planning/logging/history controls, and required migration **009**.

See the [current unified Calendar/Library integration and historical ratings guide](docs/unified-calendar.md) for migration **008**, manual Supabase steps, acceptance tests, and remaining live-environment checks.

See [Phase 1 functionality, safe development migration steps, privacy model, and verification](docs/calendar-phase-1.md). Calendar persistence requires additive migration `202611170006_calendar.sql`; it has not been applied to production automatically.

The [visual hobby-card follow-up](docs/calendar-hobby-flow.md) adds type-first library selection, cover search, catalog-to-library saving, and tracking status defaults. It requires migration `007`, reviewed and tested in development before a separate production rollout. Books remains a placeholder for the future full book library.

## Supabase authentication (Phase 2A)

See [setup, migration, security, and manual testing instructions](docs/SUPABASE_SETUP.md). Start with `.env.example`; never commit credentials.

## Movies, TV Shows, and Actors

See [TMDB setup, the new migration, security, and acceptance checks](docs/TMDB_SETUP.md). The TMDB token is server-only; personal viewing activity and actor follows require the new Supabase migration.

## Run on another computer

Built and tested with Node.js 24.

```sh
git clone https://github.com/hoopesjake/Hobbyist.git
cd Hobbyist
npm ci
```

Create `.env.local` using `.env.example`, then fill in your Supabase URL/publishable key, `NEXT_PUBLIC_SITE_URL=http://localhost:3000`, and server-only `TMDB_READ_ACCESS_TOKEN`. Transfer existing credentials privately; `.env.local` is intentionally excluded from Git.

```sh
npm run dev
```

Open http://localhost:3000. Using the same Supabase project keeps your existing account and saved activity. Do not rerun migrations already applied to that project.

See [the latest Movies/TV separation, episode tracking, migration, and testing guide](docs/MOVIES_TV_SEPARATION.md). It includes season Watch all and the current review behavior. Apply only migrations your Supabase project has not already received, in filename order.

Books is now active with Open Library search, personal reading records and linked Calendar sessions. See [Books setup and verification](docs/BOOKS_SETUP.md) for environment configuration, migration 011, tests and hosted acceptance checks. No Open Library API key is required.
