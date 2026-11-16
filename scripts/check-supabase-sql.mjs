// Optional local-only PostgreSQL/RLS check. No connection to hosted Supabase.
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
const load = createRequire(import.meta.url);
const modulePath = process.env.HOBBYIST_SQL_TEST_MODULE;
if (!modulePath) throw new Error("Set HOBBYIST_SQL_TEST_MODULE to a temporary installation of @electric-sql/pglite. See docs/TMDB_SETUP.md.");
const { PGlite } = load(modulePath);
const database = new PGlite();
try {
  await database.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, email text, created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  for (const file of [
    "supabase/migrations/202611160001_profiles.sql",
    "supabase/migrations/202611160002_tmdb_viewing.sql",
    "supabase/tests/profiles_rls.sql",
    "supabase/tests/tmdb_viewing_rls.sql",
    "supabase/migrations/202611160003_separate_movies_tv.sql",
    "supabase/tests/separate_tracking_rls.sql",
  ]) {
    if (file.endsWith("202611160003_separate_movies_tv.sql")) {
      await database.exec(`
        insert into auth.users(id,email) values('77777777-7777-4777-8777-777777777777','migration-fixture@example.invalid');
        insert into public.viewing_entries(user_id,media_type,tmdb_id,title,status,rating,started_on,watched_on) values
          ('77777777-7777-4777-8777-777777777777','movie',550,'Legacy watched','completed',4.5,null,current_date-1),
          ('77777777-7777-4777-8777-777777777777','movie',551,'Legacy progress','watching',3,current_date-5,null),
          ('77777777-7777-4777-8777-777777777777','tv',1396,'Legacy planned','watchlist',2.5,null,null),
          ('77777777-7777-4777-8777-777777777777','tv',1399,'Legacy completed','completed',5,current_date-10,current_date-2);
      `);
    }
    await database.exec(await readFile(new URL(`../${file}`, import.meta.url), "utf8"));
    console.log(`PASS ${file}`);
    if (file.endsWith("202611160003_separate_movies_tv.sql")) {
      await database.exec(`do $$ begin
        if (select count(*) from public.viewing_entries)<>4 then raise exception 'Legacy data lost'; end if;
        if not (select watched from public.movie_tracking where tmdb_id=550) or (select rating from public.movie_tracking where tmdb_id=550)<>4.5 then raise exception 'Watched movie migration failed'; end if;
        if not (select on_watchlist from public.movie_tracking where tmdb_id=551) then raise exception 'Legacy movie progress mapping failed'; end if;
        if (select status from public.tv_tracking where tmdb_id=1396)<>'planned' then raise exception 'Planned show migration failed'; end if;
        if (select completed_on from public.tv_tracking where tmdb_id=1399)<>current_date-2 then raise exception 'Show completion date lost'; end if;
      end $$;`);
      console.log("PASS migration preservation and legacy mapping");
    }
  }
} finally { await database.close(); }
