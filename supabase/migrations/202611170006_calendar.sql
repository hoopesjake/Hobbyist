-- Calendar Phase 1. Additive: no existing tracking records or schemas are changed.
begin;
create table public.calendar_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('plan','actual')),
  status text check (status in ('planned','changed','completed','skipped','canceled')),
  plan_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  category text not null check (category in ('movies','tv','games','books','music','lego','projects','other')),
  event_date date not null check (event_date between date '1900-01-01' and date '2199-12-31'),
  start_time time(0), end_date date, end_time time(0),
  time_zone text not null check (char_length(time_zone) between 1 and 100),
  starts_at timestamptz, ends_at timestamptz,
  duration_minutes integer check (duration_minutes between 1 and 10080),
  approximate boolean not null default false,
  notes text not null default '' check (char_length(notes) <= 10000),
  participants text not null default '' check (char_length(participants) <= 500),
  privacy text not null default 'private' check (privacy = 'private'),
  media_type text check (media_type in ('movie','tv','game')),
  provider text check (provider in ('tmdb','igdb')),
  provider_id integer check (provider_id > 0),
  media_title text check (char_length(media_title) between 1 and 500),
  season_number integer check (season_number between 0 and 99999),
  episode_number integer check (episode_number between 1 and 99999),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id,id),
  foreign key (user_id,plan_id) references public.calendar_entries(user_id,id) on delete set null (plan_id),
  check ((kind='plan' and status is not null and plan_id is null) or (kind='actual' and status is null)),
  check (plan_id is null or plan_id <> id),
  check ((start_time is null) = (starts_at is null)),
  check ((end_time is null) = (ends_at is null) and (end_time is null) = (end_date is null)),
  check (ends_at is null or (starts_at is not null and ends_at > starts_at and duration_minutes is not null and extract(epoch from ends_at-starts_at)=duration_minutes*60)),
  check (not approximate or (duration_minutes is not null and ends_at is null)),
  check ((media_type is null and provider is null and provider_id is null and media_title is null) or
    (media_type is not null and provider is not null and provider_id is not null and media_title is not null and
      ((media_type='game' and provider='igdb' and category='games') or (media_type='movie' and provider='tmdb' and category='movies') or (media_type='tv' and provider='tmdb' and category='tv')))),
  check ((season_number is null and episode_number is null) or (media_type is not null and media_type='tv' and season_number is not null))
);
create index calendar_owner_dates on public.calendar_entries(user_id,event_date,start_time,id);
create index calendar_owner_actual on public.calendar_entries(user_id,event_date desc,id) where kind='actual';
create index calendar_owner_media on public.calendar_entries(user_id,media_type,provider_id,event_date);
create unique index calendar_one_actual_per_plan on public.calendar_entries(user_id,plan_id) where plan_id is not null;
alter table public.calendar_entries enable row level security;
revoke all on public.calendar_entries from public,anon,authenticated;
grant select,delete on public.calendar_entries to authenticated;
grant insert(id,user_id,kind,status,plan_id,title,category,event_date,start_time,end_date,end_time,time_zone,starts_at,ends_at,duration_minutes,approximate,notes,participants,privacy,media_type,provider,provider_id,media_title,season_number,episode_number),
  update(status,title,category,event_date,start_time,end_date,end_time,time_zone,starts_at,ends_at,duration_minutes,approximate,notes,participants,privacy,media_type,provider,provider_id,media_title,season_number,episode_number)
  on public.calendar_entries to authenticated;
create policy "Calendar owner reads" on public.calendar_entries for select to authenticated using (user_id=(select auth.uid()));
create policy "Calendar owner creates" on public.calendar_entries for insert to authenticated with check (user_id=(select auth.uid()));
create policy "Calendar owner updates" on public.calendar_entries for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy "Calendar owner deletes" on public.calendar_entries for delete to authenticated using (user_id=(select auth.uid()));

create function public.validate_calendar_entry() returns trigger language plpgsql security invoker set search_path='' as $$
declare changed_media boolean; linked_kind text;
begin
  if tg_op='UPDATE' and (new.id,new.user_id,new.kind,new.created_at) is distinct from (old.id,old.user_id,old.kind,old.created_at) then
    raise exception 'Calendar identity cannot change' using errcode='42501';
  end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.time_zone) then raise exception 'Invalid time zone' using errcode='23514'; end if;
  if new.starts_at is not null and ((new.starts_at at time zone new.time_zone)::date <> new.event_date or (new.starts_at at time zone new.time_zone)::time <> new.start_time) then
    raise exception 'Start clock and instant must agree' using errcode='23514';
  end if;
  if new.ends_at is not null and ((new.ends_at at time zone new.time_zone)::date <> new.end_date or (new.ends_at at time zone new.time_zone)::time <> new.end_time) then
    raise exception 'End clock and instant must agree' using errcode='23514';
  end if;
  if new.kind='actual' and (new.event_date>(now() at time zone new.time_zone)::date or new.starts_at>now() or new.ends_at>now()) then
    raise exception 'Actual activity cannot be in the future' using errcode='23514';
  end if;
  if new.plan_id is not null then
    select kind into linked_kind from public.calendar_entries where id=new.plan_id and user_id=new.user_id for update;
    if linked_kind is distinct from 'plan' then raise exception 'An owned plan is required' using errcode='23514'; end if;
  end if;
  changed_media := tg_op='INSERT';
  if tg_op='UPDATE' then changed_media := (new.media_type,new.provider_id) is distinct from (old.media_type,old.provider_id); end if;
  if new.media_type is not null and changed_media then
    if (new.media_type='movie' and not exists(select 1 from public.movie_tracking where user_id=new.user_id and tmdb_id=new.provider_id)) or
       (new.media_type='tv' and not exists(select 1 from public.tv_tracking where user_id=new.user_id and tmdb_id=new.provider_id)) or
       (new.media_type='game' and not exists(select 1 from public.game_tracking where user_id=new.user_id and igdb_id=new.provider_id)) then
      raise exception 'Choose an item from your own library' using errcode='23514';
    end if;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;
create trigger calendar_validate before insert or update on public.calendar_entries for each row execute function public.validate_calendar_entry();

-- Only an actual log can complete a linked plan. This never touches media tracking.
create function public.complete_calendar_plan() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.kind='actual' and new.plan_id is not null then
    update public.calendar_entries set status='completed' where id=new.plan_id and user_id=new.user_id and kind='plan' and status<>'completed';
  end if;
  return new;
end $$;
create trigger calendar_complete_plan after insert on public.calendar_entries for each row execute function public.complete_calendar_plan();
revoke all on function public.validate_calendar_entry(),public.complete_calendar_plan() from public,anon,authenticated;
commit;
