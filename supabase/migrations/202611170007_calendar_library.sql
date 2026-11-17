-- Calendar-first additions. Apply after 006; existing tracking is preserved.
begin;
alter table public.calendar_entries add column media_image text
  check (media_image is null or media_image ~ '^https://(image\.tmdb\.org/t/p/w(342|500)/[A-Za-z0-9_.-]+|images\.igdb\.com/igdb/image/upload/t_cover_big/[A-Za-z0-9_-]+\.jpg)$');
alter table public.calendar_entries add column library_add boolean not null default false;
grant insert(media_image,library_add),update(media_image,library_add) on public.calendar_entries to authenticated;

-- This BEFORE trigger sorts before calendar_validate, so a verified new catalog
-- item enters the owner's library before the existing membership check runs.
-- Inserts and the event save share a transaction; any later error rolls back both.
create function public.add_calendar_library_item() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if not new.library_add or new.media_type is null then return new; end if;
  if tg_op='UPDATE' and (new.media_type,new.provider_id,new.library_add) is not distinct from (old.media_type,old.provider_id,old.library_add) then return new; end if;
  if new.user_id is distinct from (select auth.uid()) then
    raise exception 'Calendar owner required' using errcode='42501';
  end if;
  if new.media_type='movie' then
    insert into public.movie_tracking(user_id,tmdb_id,on_watchlist,watched,watched_on)
    values(new.user_id,new.provider_id,new.kind='plan',new.kind='actual',case when new.kind='actual' then new.event_date else null end)
    on conflict (user_id,tmdb_id) do nothing;
  elsif new.media_type='tv' then
    insert into public.tv_tracking(user_id,tmdb_id,status,started_on)
    values(new.user_id,new.provider_id,case when new.kind='actual' then 'watching' else 'planned' end,case when new.kind='actual' then new.event_date else null end)
    on conflict (user_id,tmdb_id) do nothing;
  elsif new.media_type='game' then
    insert into public.game_tracking(user_id,igdb_id,status,started_on,last_played_on)
    values(new.user_id,new.provider_id,case when new.kind='actual' then 'playing' else 'backlog' end,
      case when new.kind='actual' then new.event_date else null end,case when new.kind='actual' then new.event_date else null end)
    on conflict (user_id,igdb_id) do nothing;
  end if;
  -- Actual sessions advance unfinished tracking with field-specific changes.
  -- Existing ratings, reviews, completed statuses and recorded dates survive.
  if new.kind='actual' and new.media_type='movie' then
    update public.movie_tracking set watched=true,on_watchlist=false,watched_on=coalesce(watched_on,new.event_date)
    where user_id=new.user_id and tmdb_id=new.provider_id and not watched;
  elsif new.kind='actual' and new.media_type='tv' then
    update public.tv_tracking set status='watching'
    where user_id=new.user_id and tmdb_id=new.provider_id and status in ('planned','paused','dropped');
  elsif new.kind='actual' and new.media_type='game' then
    update public.game_tracking set status='playing'
    where user_id=new.user_id and igdb_id=new.provider_id and (status is null or status in ('backlog','paused','dropped'));
  end if;
  return new;
end $$;
revoke all on function public.add_calendar_library_item() from public,anon,authenticated;
create trigger calendar_add_library before insert or update on public.calendar_entries for each row execute function public.add_calendar_library_item();
commit;
