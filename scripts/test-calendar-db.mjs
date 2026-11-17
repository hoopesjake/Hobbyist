// Isolated PostgreSQL verification. No connection strings, credentials or network.
import { readFile, readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
const modulePath = process.env.CALENDAR_PGLITE_MODULE || "node_modules/.cache/calendar-tools/node_modules/@electric-sql/pglite/dist/index.js";
const { PGlite } = await import(pathToFileURL(path.resolve(modulePath)).href);
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key, email text, created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    -- Minimal Storage tables for exercising the actual RLS policies, not a mock
    -- of the Storage HTTP service (which requires separate hosted verification).
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text, unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated,anon;
    grant select,insert,update,delete on storage.objects to authenticated;`);
  for (const file of (await readdir("supabase/migrations")).filter(file => file.endsWith(".sql")).sort()) {
    if (file === "202611170008_unified_activity.sql") await db.exec(await readFile("supabase/tests/unified_activity_upgrade_before.sql", "utf8"));
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    if (file === "202611170008_unified_activity.sql") await db.exec(await readFile("supabase/tests/unified_activity_upgrade_after.sql", "utf8"));
    console.log(`Migration passed: ${file}`);
  }
  await db.exec(await readFile("supabase/tests/calendar_rls.sql", "utf8"));
  await db.exec(await readFile("supabase/tests/calendar_library_rls.sql", "utf8"));
  await db.exec(await readFile("supabase/tests/unified_activity.sql", "utf8"));
  await db.exec(await readFile("supabase/tests/activity_photos.sql", "utf8"));
  await db.exec(await readFile("supabase/tests/books.sql", "utf8"));
  console.log("Calendar SQL upgrade, synchronization, historical ratings, provenance, atomic rollback, persistence, DST, deletion and RLS tests passed.");
} catch (error) {
  console.error("Calendar database verification failed:", error.message, error.code || "", error.detail || "", error.where || "");
  process.exitCode = 1;
} finally { await db.close(); }
