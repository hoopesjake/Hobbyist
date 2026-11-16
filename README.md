# Hobbyist
Hobby tracking web app

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
