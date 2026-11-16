-- Apply after migrations 001 and 002. Existing records remain intact.
begin;
create table public.movie_tracking (
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id integer not null check (tmdb_id > 0),
  on_watchlist boolean not null default false,
  watched boolean not null default false,
  watched_on date,
  rating numeric check (rating between 0.5 and 5 and rating * 2 = trunc(rating * 2)),
  review text not null default '' check (char_length(review) <= 10000),
  contains_spoilers boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (user_id, tmdb_id), check (watched or watched_on is null)
);
create table public.tv_tracking (
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id integer not null check (tmdb_id > 0),
  status text not null default 'planned' check (status in ('planned','watching','watched','paused','dropped','completed')),
  started_on date, completed_on date,
  rating numeric check (rating between 0.5 and 5 and rating * 2 = trunc(rating * 2)),
  review text not null default '' check (char_length(review) <= 10000),
  contains_spoilers boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (user_id, tmdb_id),
  check (started_on is null or completed_on is null or completed_on >= started_on)
);
create table public.tv_episode_tracking (
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_show_id integer not null check (tmdb_show_id > 0),
  season_number integer not null check (season_number between 0 and 99999),
  episode_number integer not null check (episode_number between 1 and 99999),
  tmdb_episode_id integer not null check (tmdb_episode_id > 0),
  watched boolean not null default false, watched_on date,
  rating numeric check (rating between 0.5 and 5 and rating * 2 = trunc(rating * 2)),
  review text not null default '' check (char_length(review) <= 10000),
  contains_spoilers boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (user_id, tmdb_show_id, season_number, episode_number),
  unique (user_id, tmdb_episode_id),
  foreign key (user_id, tmdb_show_id) references public.tv_tracking(user_id, tmdb_id) on delete cascade,
  check (watched or watched_on is null)
);
create index movie_tracking_recent on public.movie_tracking (user_id, updated_at desc);
create index movie_tracking_watched on public.movie_tracking (user_id, watched_on desc) where watched;
create index tv_tracking_status on public.tv_tracking (user_id,status,updated_at desc);
create index tv_episode_watched on public.tv_episode_tracking (user_id,tmdb_show_id,season_number) where watched;
-- One-time migration. No old records or dates are discarded.
-- Non-completed legacy movie progress states become a watchlist entry.
insert into public.movie_tracking (user_id,tmdb_id,on_watchlist,watched,watched_on,rating,created_at,updated_at)
select user_id,tmdb_id,status <> 'completed',status = 'completed' or watched_on is not null,watched_on,rating,created_at,updated_at
from public.viewing_entries where media_type='movie';
insert into public.tv_tracking (user_id,tmdb_id,status,started_on,completed_on,rating,created_at,updated_at)
select user_id,tmdb_id,case when status='watchlist' then 'planned' else status end,started_on,watched_on,rating,created_at,updated_at
from public.viewing_entries where media_type='tv';
-- Freeze the legacy archive so old tabs cannot produce divergent active records.
-- Keep SELECT/RLS and all old data, including the append-only viewing_events.
revoke insert,update,delete on public.viewing_entries from authenticated;
revoke insert (user_id,media_type,tmdb_id,title,poster_path,status,rating,started_on,watched_on),
 update (user_id,media_type,tmdb_id,title,poster_path,status,rating,started_on,watched_on)
 on public.viewing_entries from authenticated;
-- The catalog stays in the server's TMDB cache, separate from personal data.
do $$ declare relation text; begin
  foreach relation in array array['movie_tracking','tv_tracking','tv_episode_tracking'] loop
    execute format('alter table public.%I enable row level security',relation);
    execute format('revoke all on public.%I from public,anon,authenticated',relation);
    execute format('grant select,delete on public.%I to authenticated',relation);
    execute format('create policy "Owner read" on public.%I for select to authenticated using ((select auth.uid())=user_id)',relation);
    execute format('create policy "Owner insert" on public.%I for insert to authenticated with check ((select auth.uid())=user_id)',relation);
    execute format('create policy "Owner update" on public.%I for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',relation);
    execute format('create policy "Owner delete" on public.%I for delete to authenticated using ((select auth.uid())=user_id)',relation);
  end loop;
end $$;
grant insert (user_id,tmdb_id,on_watchlist,watched,watched_on,rating,review,contains_spoilers), update (user_id,tmdb_id,on_watchlist,watched,watched_on,rating,review,contains_spoilers) on public.movie_tracking to authenticated;
grant insert (user_id,tmdb_id,status,started_on,completed_on,rating,review,contains_spoilers), update (user_id,tmdb_id,status,started_on,completed_on,rating,review,contains_spoilers) on public.tv_tracking to authenticated;
grant insert (user_id,tmdb_show_id,season_number,episode_number,tmdb_episode_id,watched,watched_on,rating,review,contains_spoilers), update (user_id,tmdb_show_id,season_number,episode_number,tmdb_episode_id,watched,watched_on,rating,review,contains_spoilers) on public.tv_episode_tracking to authenticated;
create function public.validate_separate_tracking() returns trigger language plpgsql set search_path='' as $$
declare value jsonb := to_jsonb(new); previous jsonb; field text; begin
  if tg_op='UPDATE' then
    previous := to_jsonb(old);
    foreach field in array array['user_id','tmdb_id','tmdb_show_id','season_number','episode_number','tmdb_episode_id','created_at'] loop
      if value->field is distinct from previous->field then raise exception 'Tracking identity cannot be changed' using errcode='42501'; end if;
    end loop;
  end if;
  foreach field in array array['watched_on','started_on','completed_on'] loop
    if (value->>field)::date > current_date then raise exception 'Tracking dates cannot be in the future' using errcode='23514'; end if;
  end loop;
  new.updated_at := now();
  return new;
end $$;
create trigger validate_movie_tracking before insert or update on public.movie_tracking for each row execute function public.validate_separate_tracking();
create trigger validate_tv_tracking before insert or update on public.tv_tracking for each row execute function public.validate_separate_tracking();
create trigger validate_episode_tracking before insert or update on public.tv_episode_tracking for each row execute function public.validate_separate_tracking();
revoke all on function public.validate_separate_tracking() from public,anon,authenticated;
create function public.media_tracking_stats() returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object(
 'movies',(select jsonb_build_object('tracked',count(*),'watchlist',count(*) filter(where on_watchlist),'watched',count(*) filter(where watched),'rated',count(rating),'average_rating',avg(rating)) from public.movie_tracking where user_id=(select auth.uid())),
 'tv',(select jsonb_build_object('tracked',count(*),'watching',count(*) filter(where status='watching'),'completed',count(*) filter(where status='completed'),'rated',count(rating),'average_rating',avg(rating)) from public.tv_tracking where user_id=(select auth.uid())),
 'episodes_watched',(select count(*) from public.tv_episode_tracking where user_id=(select auth.uid()) and watched)
);
$$;
revoke all on function public.media_tracking_stats() from public,anon;
grant execute on function public.media_tracking_stats() to authenticated;
commit;
