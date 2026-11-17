-- Apply after 001-007. Private sessions remain the activity source of truth.
begin;
alter table public.calendar_entries
  add column session_rating numeric check(session_rating between 0.5 and 5 and session_rating*2=trunc(session_rating*2)),
  add column episodes jsonb not null default '[]' check(jsonb_typeof(episodes)='array' and jsonb_array_length(episodes)<=100),
  add column source_key text check(char_length(source_key)<=120),
  add constraint calendar_actual_rating check(session_rating is null or (kind='actual' and media_type is not null and media_type in ('movie','tv','game'))),
  add constraint calendar_tv_episodes check(episodes='[]'::jsonb or (kind='actual' and media_type is not null and media_type='tv'));
create unique index calendar_tracking_source on public.calendar_entries(user_id,source_key) where source_key is not null;
grant insert(session_rating,episodes,source_key),update(session_rating,episodes) on public.calendar_entries to authenticated;

-- Attribute calendar-supplied primary dates so corrections can follow their
-- source without changing pre-existing manual dates or a later rewatch's history.
alter table public.movie_tracking add column watched_activity_id uuid,
  add foreign key(user_id,watched_activity_id) references public.calendar_entries(user_id,id) on delete set null(watched_activity_id);
alter table public.tv_episode_tracking add column watched_activity_id uuid,
  add foreign key(user_id,watched_activity_id) references public.calendar_entries(user_id,id) on delete set null(watched_activity_id);
grant insert(watched_activity_id),update(watched_activity_id) on public.movie_tracking,public.tv_episode_tracking to authenticated;

create or replace function public.add_calendar_library_item() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if not new.library_add or new.media_type is null then return new; end if;
  if tg_op='UPDATE' and (new.media_type,new.provider_id,new.library_add) is not distinct from (old.media_type,old.provider_id,old.library_add) then return new; end if;
  if new.user_id is distinct from (select auth.uid()) then
    raise exception 'Calendar owner required' using errcode='42501';
  end if;
  if new.media_type='movie' then
    insert into public.movie_tracking(user_id,tmdb_id,on_watchlist,watched,watched_on)
    values(new.user_id,new.provider_id,new.kind='plan',false,null)
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
  if new.kind='actual' and new.media_type='tv' then
    update public.tv_tracking set status='watching'
    where user_id=new.user_id and tmdb_id=new.provider_id and status in ('planned','paused','dropped');
  elsif new.kind='actual' and new.media_type='game' then
    update public.game_tracking set status='playing'
    where user_id=new.user_id and igdb_id=new.provider_id and (status is null or status in ('backlog','paused','dropped'));
  end if;
  return new;
end $$;

create function public.validate_activity_episodes() returns trigger language plpgsql security invoker set search_path='' as $$
declare e jsonb; identities text[]='{}'; k text; begin
  for e in select value from jsonb_array_elements(new.episodes) loop
    if jsonb_typeof(e)<>'object' or (e->>'season_number') is null or (e->>'episode_number') is null or (e->>'tmdb_episode_id') is null
      or (e->>'season_number')::integer not between 0 and 99999 or (e->>'episode_number')::integer not between 1 and 99999 or (e->>'tmdb_episode_id')::integer<=0
      or (e ? 'rating' and e->'rating'<>'null'::jsonb and ((e->>'rating')::numeric not between 0.5 and 5 or (e->>'rating')::numeric*2<>trunc((e->>'rating')::numeric*2)))
      then raise exception 'Invalid session episode' using errcode='23514'; end if;
    k=(e->>'season_number')||':'||(e->>'episode_number');
    if k=any(identities) then raise exception 'Duplicate session episode' using errcode='23514'; end if;
    identities=array_append(identities,k);
  end loop;
  if tg_op='UPDATE' and new.source_key is distinct from old.source_key then raise exception 'Activity source cannot change' using errcode='42501'; end if;
  return new;
end $$;
create trigger calendar_episode_validate before insert or update on public.calendar_entries for each row execute function public.validate_activity_episodes();

-- Field-specific tracking updates are transactional with the session. Ratings,
-- reviews, manual game time and completed game/show statuses are never inferred.
create function public.sync_actual_activity() returns trigger language plpgsql security invoker set search_path='' as $$
declare e jsonb; begin
  if tg_op='UPDATE' then
    update public.movie_tracking set watched_activity_id=null where user_id=new.user_id and watched_activity_id=new.id
      and (new.media_type is distinct from 'movie' or tmdb_id is distinct from new.provider_id);
    update public.tv_episode_tracking t set watched_activity_id=null where t.user_id=new.user_id and t.watched_activity_id=new.id
      and (new.media_type is distinct from 'tv' or t.tmdb_show_id is distinct from new.provider_id
        or not exists(select 1 from jsonb_array_elements(new.episodes) j where (j->>'tmdb_episode_id')::integer=t.tmdb_episode_id));
  end if;
  if new.kind<>'actual' or new.media_type is null then return new; end if;
  if tg_op='INSERT' and new.source_key is not null then return new; end if;
  if tg_op='UPDATE' and (new.media_type,new.provider_id,new.event_date,new.episodes) is not distinct from (old.media_type,old.provider_id,old.event_date,old.episodes) then return new; end if;
  if new.media_type='movie' then
    update public.movie_tracking set watched=true,on_watchlist=false,
      watched_activity_id=case when watched_on is null or watched_activity_id=new.id then new.id else watched_activity_id end,
      watched_on=case when watched_activity_id=new.id then new.event_date else coalesce(watched_on,new.event_date) end
      where user_id=new.user_id and tmdb_id=new.provider_id;
  elsif new.media_type='tv' then
    update public.tv_tracking set status=case when status in ('planned','paused','dropped') then 'watching' else status end,
      started_on=coalesce(started_on,new.event_date) where user_id=new.user_id and tmdb_id=new.provider_id;
    for e in select value from jsonb_array_elements(new.episodes) loop
      insert into public.tv_episode_tracking(user_id,tmdb_show_id,season_number,episode_number,tmdb_episode_id,watched,watched_on,watched_activity_id)
        values(new.user_id,new.provider_id,(e->>'season_number')::integer,(e->>'episode_number')::integer,(e->>'tmdb_episode_id')::integer,true,new.event_date,new.id)
      on conflict(user_id,tmdb_show_id,season_number,episode_number) do update
        set watched=true,
          watched_activity_id=case when public.tv_episode_tracking.watched_on is null or public.tv_episode_tracking.watched_activity_id=new.id then new.id else public.tv_episode_tracking.watched_activity_id end,
          watched_on=case when public.tv_episode_tracking.watched_activity_id=new.id then excluded.watched_on else coalesce(public.tv_episode_tracking.watched_on,excluded.watched_on) end;
    end loop;
  end if;
  return new;
end $$;
create trigger calendar_sync_actual after insert or update on public.calendar_entries for each row execute function public.sync_actual_activity();

-- Explicit dates entered through existing Movie/Episode controls appear once in
-- the calendar. Rating/list/status-only writes never invent a dated experience.
create function public.sync_tracking_activity() returns trigger language plpgsql security invoker set search_path='' as $$
declare key text; typ text; media_id integer; label text; eps jsonb='[]'; existing uuid; begin
  if pg_trigger_depth()>1 or not new.watched or new.watched_on is null then return new; end if;
  if tg_op='UPDATE' and (new.watched,new.watched_on) is not distinct from (old.watched,old.watched_on) then return new; end if;
  if tg_table_name='movie_tracking' then
    typ='movie'; media_id=new.tmdb_id; key='movie:'||media_id; label='Movie #'||media_id;
  else
    typ='tv'; media_id=new.tmdb_show_id; key='episode:'||media_id||':'||new.season_number||':'||new.episode_number; label='TV show #'||media_id;
    eps=jsonb_build_array(jsonb_build_object('season_number',new.season_number,'episode_number',new.episode_number,'tmdb_episode_id',new.tmdb_episode_id));
  end if;
  select id into existing from public.calendar_entries where user_id=new.user_id and source_key=key;
  if existing is null and tg_op='UPDATE' then existing=old.watched_activity_id; end if;
  if existing is null and exists(select 1 from public.calendar_entries c where c.user_id=new.user_id and c.kind='actual'
    and c.media_type=typ and c.provider_id=media_id and c.event_date=new.watched_on
    and (typ='movie' or c.episodes @> eps)) then return new; end if;
  if existing is not null then
    update public.calendar_entries set event_date=new.watched_on,start_time=null,starts_at=null,end_date=null,end_time=null,ends_at=null
      where id=existing and user_id=new.user_id;
  else
    -- A current library rating is not evidence of a rating on a historical date.
    insert into public.calendar_entries(user_id,kind,title,category,event_date,time_zone,media_type,provider,provider_id,media_title,episodes,source_key)
      values(new.user_id,'actual',label,case when typ='movie' then 'movies' else 'tv' end,new.watched_on,'UTC',typ,'tmdb',media_id,label,eps,key);
  end if;
  return new;
end $$;
create function public.clear_manual_date_origin() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if pg_trigger_depth()=1 and tg_op='UPDATE' and (new.watched,new.watched_on) is distinct from (old.watched,old.watched_on) then new.watched_activity_id=null; end if;
 return new;
end $$;
create trigger movie_manual_date_origin before update on public.movie_tracking for each row execute function public.clear_manual_date_origin();
create trigger episode_manual_date_origin before update on public.tv_episode_tracking for each row execute function public.clear_manual_date_origin();
revoke all on function public.clear_manual_date_origin() from public,anon,authenticated;
create trigger movie_calendar_activity after insert or update on public.movie_tracking for each row execute function public.sync_tracking_activity();
create trigger episode_calendar_activity after insert or update on public.tv_episode_tracking for each row execute function public.sync_tracking_activity();

-- One authenticated operation saves the activity, episode progress and explicit
-- rating/review changes. Optimistic concurrency prevents stale editor writes.
create function public.save_calendar_activity(p_entry jsonb,p_expected timestamptz default null,p_rating numeric default null,
  p_rating_changed boolean default false,p_update_current boolean default false,p_review text default null,p_spoilers boolean default false,
  p_episodes jsonb default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare previous public.calendar_entries; item public.calendar_entries; saved uuid; e jsonb; clean jsonb='[]'; old_e jsonb; begin
  if (select auth.uid()) is null then raise exception 'Sign in required' using errcode='42501'; end if;
  select * into previous from public.calendar_entries where id=(p_entry->>'id')::uuid and user_id=(select auth.uid()) for update;
  if p_expected is not null and (previous.id is null or previous.updated_at<>p_expected) then raise exception 'Activity changed; refresh before editing' using errcode='40001'; end if;
  if p_expected is null and previous.id is not null then raise exception 'Activity already saved' using errcode='23505'; end if;
  item=jsonb_populate_record(previous,p_entry);
  item.user_id=(select auth.uid());
  if not p_rating_changed then item.session_rating=previous.session_rating; else item.session_rating=p_rating; end if;
  if p_episodes is not null then
    if jsonb_typeof(p_episodes)<>'array' or jsonb_array_length(p_episodes)>100 then raise exception 'Invalid episodes' using errcode='23514'; end if;
    for e in select value from jsonb_array_elements(p_episodes) loop
      old_e=null;
      if (item.media_type,item.provider_id) is not distinct from (previous.media_type,previous.provider_id) then
        select value into old_e from jsonb_array_elements(coalesce(previous.episodes,'[]')) where value->>'season_number'=e->>'season_number' and value->>'episode_number'=e->>'episode_number';
      end if;
      clean=clean||jsonb_build_array((e-'rating_changed'-'update_current'-'rating')||jsonb_build_object('rating',case when coalesce((e->>'rating_changed')::boolean,false) then e->'rating' else old_e->'rating' end));
    end loop;
    item.episodes=clean;
  else item.episodes=coalesce(previous.episodes,'[]'); end if;
  if item.media_type is distinct from 'tv' then item.episodes='[]'; end if;
  if previous.id is not null and (item.media_type,item.provider_id) is distinct from (previous.media_type,previous.provider_id) and not p_rating_changed then item.session_rating=null; end if;
  if p_expected is null then
    insert into public.calendar_entries(id,user_id,kind,status,plan_id,title,category,event_date,start_time,end_date,end_time,time_zone,starts_at,ends_at,duration_minutes,approximate,notes,participants,privacy,media_type,provider,provider_id,media_title,season_number,episode_number,media_image,library_add,session_rating,episodes)
      values(item.id,item.user_id,item.kind,item.status,item.plan_id,item.title,item.category,item.event_date,item.start_time,item.end_date,item.end_time,item.time_zone,item.starts_at,item.ends_at,item.duration_minutes,item.approximate,item.notes,item.participants,'private',item.media_type,item.provider,item.provider_id,item.media_title,item.season_number,item.episode_number,item.media_image,coalesce(item.library_add,false),item.session_rating,item.episodes) returning id into saved;
  else
    if (item.kind,item.plan_id) is distinct from (previous.kind,previous.plan_id) then raise exception 'Activity identity cannot change' using errcode='42501'; end if;
    update public.calendar_entries set status=item.status,title=item.title,category=item.category,event_date=item.event_date,start_time=item.start_time,end_date=item.end_date,end_time=item.end_time,time_zone=item.time_zone,starts_at=item.starts_at,ends_at=item.ends_at,duration_minutes=item.duration_minutes,approximate=item.approximate,notes=item.notes,participants=item.participants,media_type=item.media_type,provider=item.provider,provider_id=item.provider_id,media_title=item.media_title,season_number=item.season_number,episode_number=item.episode_number,media_image=item.media_image,library_add=coalesce(item.library_add,false),session_rating=item.session_rating,episodes=item.episodes
      where id=item.id and user_id=item.user_id returning id into saved;
  end if;
  if item.kind='actual' and p_rating_changed and p_update_current and p_rating is not null then
    if item.media_type='movie' then update public.movie_tracking set rating=p_rating where user_id=item.user_id and tmdb_id=item.provider_id;
    elsif item.media_type='tv' then update public.tv_tracking set rating=p_rating where user_id=item.user_id and tmdb_id=item.provider_id;
    elsif item.media_type='game' then update public.game_tracking set rating=p_rating where user_id=item.user_id and igdb_id=item.provider_id; end if;
  end if;
  if p_review is not null then
    if item.kind<>'actual' then raise exception 'Reviews require actual activity' using errcode='23514'; end if;
    if item.media_type='movie' then update public.movie_tracking set review=p_review,contains_spoilers=p_spoilers where user_id=item.user_id and tmdb_id=item.provider_id;
    elsif item.media_type='tv' then update public.tv_tracking set review=p_review,contains_spoilers=p_spoilers where user_id=item.user_id and tmdb_id=item.provider_id;
    elsif item.media_type='game' then update public.game_tracking set review=p_review,contains_spoilers=p_spoilers where user_id=item.user_id and igdb_id=item.provider_id; end if;
  end if;
  if item.kind='actual' and item.media_type='tv' and p_episodes is not null then
    for e in select value from jsonb_array_elements(p_episodes) loop
      if coalesce((e->>'rating_changed')::boolean,false) and coalesce((e->>'update_current')::boolean,false) and e->>'rating' is not null then
        update public.tv_episode_tracking set rating=(e->>'rating')::numeric where user_id=item.user_id and tmdb_show_id=item.provider_id and season_number=(e->>'season_number')::integer and episode_number=(e->>'episode_number')::integer;
      end if;
    end loop;
  end if;
  return saved;
end $$;
-- Backfill only known dated viewings; never fabricate dates or old ratings.
-- Skip sessions already represented by calendar logs (including multi-episode logs).
insert into public.calendar_entries(user_id,kind,title,category,event_date,time_zone,media_type,provider,provider_id,media_title,source_key)
select m.user_id,'actual','Movie #'||m.tmdb_id,'movies',m.watched_on,'UTC','movie','tmdb',m.tmdb_id,'Movie #'||m.tmdb_id,'movie:'||m.tmdb_id
from public.movie_tracking m where m.watched and m.watched_on is not null and m.watched_on between '1900-01-01' and '2199-12-31'
  and not exists(select 1 from public.calendar_entries c where c.user_id=m.user_id and c.kind='actual' and c.media_type='movie' and c.provider_id=m.tmdb_id and c.event_date=m.watched_on)
on conflict do nothing;
insert into public.calendar_entries(user_id,kind,title,category,event_date,time_zone,media_type,provider,provider_id,media_title,episodes,source_key)
select e.user_id,'actual','TV show #'||e.tmdb_show_id,'tv',e.watched_on,'UTC','tv','tmdb',e.tmdb_show_id,'TV show #'||e.tmdb_show_id,
  jsonb_build_array(jsonb_build_object('season_number',e.season_number,'episode_number',e.episode_number,'tmdb_episode_id',e.tmdb_episode_id)),
  'episode:'||e.tmdb_show_id||':'||e.season_number||':'||e.episode_number
from public.tv_episode_tracking e where e.watched and e.watched_on is not null and e.watched_on between '1900-01-01' and '2199-12-31'
  and not exists(select 1 from public.calendar_entries c where c.user_id=e.user_id and c.kind='actual' and c.media_type='tv' and c.provider_id=e.tmdb_show_id and c.event_date=e.watched_on
    and ((c.season_number=e.season_number and c.episode_number=e.episode_number) or exists(select 1 from jsonb_array_elements(c.episodes) j where (j->>'tmdb_episode_id')::integer=e.tmdb_episode_id)))
on conflict do nothing;
revoke all on function public.validate_activity_episodes(),public.sync_actual_activity(),public.sync_tracking_activity() from public,anon,authenticated;
revoke all on function public.save_calendar_activity(jsonb,timestamptz,numeric,boolean,boolean,text,boolean,jsonb) from public,anon;
grant execute on function public.save_calendar_activity(jsonb,timestamptz,numeric,boolean,boolean,text,boolean,jsonb) to authenticated;
commit;
