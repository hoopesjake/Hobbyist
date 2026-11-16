-- Additive TMDB integration. Apply after 202611160001_profiles.sql.
-- No changes to existing profiles, preferences, or authentication.
begin;
create table public.viewing_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id integer not null check (tmdb_id > 0),
  title text not null check (char_length(title) between 1 and 500),
  poster_path text check (poster_path ~ '^/[A-Za-z0-9_.-]+$' and char_length(poster_path) <= 300),
  status text not null default 'watchlist' check (status in ('watchlist', 'watching', 'completed', 'paused', 'dropped')),
  rating numeric check (rating between 0.5 and 5 and rating * 2 = trunc(rating * 2)),
  started_on date,
  watched_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, media_type, tmdb_id),
  check (started_on is null or watched_on is null or watched_on >= started_on)
);
create index viewing_entries_recent on public.viewing_entries (user_id, updated_at desc);
create index viewing_entries_status on public.viewing_entries (user_id, status, updated_at desc);
create table public.actor_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_person_id integer not null check (tmdb_person_id > 0),
  name text not null check (char_length(name) between 1 and 300),
  profile_path text check (profile_path ~ '^/[A-Za-z0-9_.-]+$' and char_length(profile_path) <= 300),
  created_at timestamptz not null default now(),
  primary key (user_id, tmdb_person_id)
);
create index actor_follows_recent on public.actor_follows (user_id, created_at desc);
-- Private append-only journal snapshots, written by a trigger, not by clients.
create table public.viewing_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id integer not null,
  media_type text not null,
  title text not null,
  poster_path text,
  status text not null,
  rating numeric,
  started_on date,
  watched_on date,
  event_type text not null check (event_type in ('added', 'updated')),
  created_at timestamptz not null default now()
);
create index viewing_events_recent on public.viewing_events (user_id, created_at desc, id desc);
alter table public.viewing_entries enable row level security;
alter table public.actor_follows enable row level security;
alter table public.viewing_events enable row level security;
revoke all on public.viewing_entries, public.actor_follows, public.viewing_events from public, anon, authenticated;
grant select, delete on public.viewing_entries to authenticated;
grant insert (user_id, media_type, tmdb_id, title, poster_path, status, rating, started_on, watched_on) on public.viewing_entries to authenticated;
-- Upsert includes the composite key; the trigger rejects any identity changes.
grant update (user_id, media_type, tmdb_id, title, poster_path, status, rating, started_on, watched_on) on public.viewing_entries to authenticated;
grant select, delete on public.actor_follows to authenticated;
grant insert (user_id, tmdb_person_id, name, profile_path) on public.actor_follows to authenticated;
grant select on public.viewing_events to authenticated;
create policy "Owners read viewing entries" on public.viewing_entries for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners insert viewing entries" on public.viewing_entries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Owners update viewing entries" on public.viewing_entries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Owners delete viewing entries" on public.viewing_entries for delete to authenticated using ((select auth.uid()) = user_id);
create policy "Owners read actor follows" on public.actor_follows for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners insert actor follows" on public.actor_follows for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Owners delete actor follows" on public.actor_follows for delete to authenticated using ((select auth.uid()) = user_id);
create policy "Owners read viewing events" on public.viewing_events for select to authenticated using ((select auth.uid()) = user_id);
create function public.prepare_viewing_entry() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.user_id, new.media_type, new.tmdb_id, new.created_at) is distinct from (old.user_id, old.media_type, old.tmdb_id, old.created_at) then
    raise exception 'Viewing identity and creation date cannot be changed' using errcode = '42501';
  end if;
  if new.started_on > current_date or new.watched_on > current_date then
    raise exception 'Watch dates cannot be in the future' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger prepare_viewing_entry before insert or update on public.viewing_entries for each row execute function public.prepare_viewing_entry();
create function public.record_viewing_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.status, new.rating, new.started_on, new.watched_on) is not distinct from (old.status, old.rating, old.started_on, old.watched_on) then return new; end if;
  insert into public.viewing_events (user_id, tmdb_id, media_type, title, poster_path, status, rating, started_on, watched_on, event_type)
  values (new.user_id, new.tmdb_id, new.media_type, new.title, new.poster_path, new.status, new.rating, new.started_on, new.watched_on, case when tg_op = 'INSERT' then 'added' else 'updated' end);
  return new;
end;
$$;
create trigger record_viewing_event after insert or update on public.viewing_entries for each row execute function public.record_viewing_event();
revoke all on function public.prepare_viewing_entry(), public.record_viewing_event() from public, anon, authenticated;
commit;
