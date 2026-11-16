-- Additive Phase 2A migration. Apply once via Supabase CLI or SQL editor.
begin;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null default 'Hobbyist' check (char_length(btrim(display_name)) between 1 and 80),
  bio text not null default '' check (char_length(bio) <= 500),
  avatar_ref text check (char_length(avatar_ref) <= 2048),
  banner_ref text check (char_length(banner_ref) <= 2048),
  created_at timestamptz not null default now(),
  visibility text not null default 'private' check (visibility in ('public', 'private'))
);
-- These preferences never belong in a public profile response.
create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object' and octet_length(settings::text) <= 16384)
);
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
revoke all on public.profiles, public.user_preferences from public, anon, authenticated;
grant select (username, display_name, bio, avatar_ref, banner_ref, created_at) on public.profiles to anon;
grant select on public.profiles to authenticated;
grant update (username, display_name, bio, avatar_ref, banner_ref, visibility) on public.profiles to authenticated;
grant select, insert, update on public.user_preferences to authenticated;
create policy "Visible profiles" on public.profiles for select to anon, authenticated
  using (visibility = 'public' or (select auth.uid()) = id);
create policy "Owners update profiles" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Owners read preferences" on public.user_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners insert preferences" on public.user_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Owners update preferences" on public.user_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Do not trust signup metadata for privileges or unique usernames.
create function public.create_hobbyist_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare candidate text;
begin
  loop
    candidate := 'h_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 28);
    begin
      insert into public.profiles (id, username, created_at) values (new.id, candidate, new.created_at);
      exit;
    exception when unique_violation then
      if exists (select 1 from public.profiles where id = new.id) then exit; end if;
    end;
  end loop;
  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.create_hobbyist_profile() from public, anon, authenticated;
create trigger on_hobbyist_user_created after insert on auth.users for each row execute function public.create_hobbyist_profile();
-- Backfill accounts that predate this migration; do not overwrite existing rows.
insert into public.profiles (id, username, created_at)
select id, 'h_' || substr(replace(id::text, '-', ''), 1, 28), created_at from auth.users on conflict (id) do nothing;
insert into public.user_preferences (user_id) select id from auth.users on conflict do nothing;
commit;
