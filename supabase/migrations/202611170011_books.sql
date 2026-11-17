-- Books: apply after 001-010. No previous media rows or schemas are replaced.
begin;
create table public.book_tracking (
 user_id uuid not null references auth.users(id) on delete cascade,
 ol_work_id integer not null check(ol_work_id>0),
 work_key text generated always as ('/works/OL'||ol_work_id::text||'W') stored,
 title text not null check(char_length(title) between 1 and 500),
 authors text[] not null default '{}',cover_url text,
 edition_id text check(edition_id ~ '^OL[1-9][0-9]*M$'),
 status text not null default 'want_to_read' check(status in ('want_to_read','reading','finished')),
 status_explicit boolean not null default false,
 total_pages integer check(total_pages between 1 and 100000),
 manual_current_page integer not null default 0 check(manual_current_page between 0 and 100000),
 rating numeric check(rating between 0.5 and 5 and rating*2=trunc(rating*2)),
 review text not null default '' check(char_length(review)<=10000),
 contains_spoilers boolean not null default false,
 private_notes text not null default '' check(char_length(private_notes)<=10000),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(user_id,ol_work_id),
 check(total_pages is null or manual_current_page<=total_pages),
 check(cover_url is null or cover_url ~ '^https://covers\.openlibrary\.org/b/id/[1-9][0-9]*-L\.jpg\?default=false$')
);
create index book_tracking_recent on public.book_tracking(user_id,updated_at desc,ol_work_id);
alter table public.book_tracking enable row level security;
revoke all on public.book_tracking from public,anon,authenticated;
grant select,delete on public.book_tracking to authenticated;
grant insert(user_id,ol_work_id,title,authors,cover_url,edition_id,status,status_explicit,total_pages,manual_current_page,rating,review,contains_spoilers,private_notes),
 update(title,authors,cover_url,edition_id,status,status_explicit,total_pages,manual_current_page,rating,review,contains_spoilers,private_notes) on public.book_tracking to authenticated;
create policy "Book owner reads" on public.book_tracking for select to authenticated using(user_id=(select auth.uid()));
create policy "Book owner inserts" on public.book_tracking for insert to authenticated with check(user_id=(select auth.uid()));
create policy "Book owner updates" on public.book_tracking for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "Book owner deletes" on public.book_tracking for delete to authenticated using(user_id=(select auth.uid()));
create function public.validate_book_tracking() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.user_id,new.ol_work_id,new.created_at) is distinct from (old.user_id,old.ol_work_id,old.created_at) then raise exception 'Book identity cannot change' using errcode='42501'; end if;
 if cardinality(new.authors)>50 then raise exception 'Too many authors' using errcode='23514'; end if;
 new.updated_at=clock_timestamp();return new;
end $$;
create trigger book_tracking_validate before insert or update on public.book_tracking for each row execute function public.validate_book_tracking();

-- Replace only media-identity checks that predate Books, preserving all date,
-- duration, privacy, plan and authentication constraints.
do $$ declare c record; begin
 for c in select conname from pg_catalog.pg_constraint where conrelid='public.calendar_entries'::regclass and contype='c' and (pg_catalog.pg_get_constraintdef(oid) like '%media_type%' or conname in ('calendar_entries_provider_check','calendar_entries_media_image_check')) loop
  execute format('alter table public.calendar_entries drop constraint %I',c.conname);
 end loop;
end $$;
alter table public.calendar_entries
 add constraint calendar_media_type check(media_type in ('movie','tv','game','book')),
 add constraint calendar_provider check(provider in ('tmdb','igdb','openlibrary')),
 add constraint calendar_media_identity check((media_type is null and provider is null and provider_id is null and media_title is null) or
  (media_type is not null and provider is not null and provider_id is not null and media_title is not null and
  ((media_type='movie' and provider='tmdb' and category='movies') or (media_type='tv' and provider='tmdb' and category='tv') or (media_type='game' and provider='igdb' and category='games') or (media_type='book' and provider='openlibrary' and category='books')))),
 add constraint calendar_tv_reference check((season_number is null and episode_number is null) or (media_type is not null and media_type='tv' and season_number is not null)),
 add constraint calendar_actual_rating check(session_rating is null or (kind='actual' and media_type is not null)),
 add constraint calendar_tv_episodes check(episodes='[]'::jsonb or (kind='actual' and media_type='tv' and media_type is not null)),
 add constraint calendar_artwork check(media_image is null or media_image ~ '^https://(image\.tmdb\.org/t/p/w(342|500)/[A-Za-z0-9_.-]+|images\.igdb\.com/igdb/image/upload/t_cover_big/[A-Za-z0-9_-]+\.jpg|covers\.openlibrary\.org/b/id/[1-9][0-9]*-L\.jpg\?default=false)$'),
 add column reading_start_page integer check(reading_start_page between 1 and 100000),
 add column reading_end_page integer check(reading_end_page between 1 and 100000),
 add column reading_edition_id text check(reading_edition_id ~ '^OL[1-9][0-9]*M$'),
 add column pages_read integer generated always as (reading_end_page-reading_start_page+1) stored,
 add constraint calendar_reading_pages check((reading_start_page is null and reading_end_page is null and reading_edition_id is null) or
  (media_type is not null and media_type='book' and kind='actual' and reading_start_page is not null and reading_end_page is not null and reading_end_page>=reading_start_page));
grant insert(reading_start_page,reading_end_page,reading_edition_id),update(reading_start_page,reading_end_page,reading_edition_id) on public.calendar_entries to authenticated;
create or replace function public.validate_calendar_entry() returns trigger language plpgsql security invoker set search_path='' as $$
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
       (new.media_type='game' and not exists(select 1 from public.game_tracking where user_id=new.user_id and igdb_id=new.provider_id)) or
       (new.media_type='book' and not exists(select 1 from public.book_tracking where user_id=new.user_id and ol_work_id=new.provider_id)) then
      raise exception 'Choose an item from your own library' using errcode='23514';
    end if;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;

-- Aggregate positions, never additive counters: retries/edits/deletions cannot
-- double-count progress. Other editions' page numbers are kept in history only.
create view public.book_library with (security_invoker=true) as
select b.*,greatest(b.manual_current_page,coalesce(s.last_page,0)) as current_page,
 case when b.status_explicit then b.status when b.status='finished' or (b.total_pages is not null and greatest(b.manual_current_page,coalesce(s.last_page,0))>=b.total_pages) then 'finished'
 when b.status='reading' or b.manual_current_page>0 or coalesce(s.sessions,0)>0 then 'reading' else 'want_to_read' end as effective_status
from public.book_tracking b left join lateral (
 select max(e.reading_end_page) as last_page,count(*) as sessions from public.calendar_entries e where e.user_id=b.user_id and e.media_type='book' and e.provider_id=b.ol_work_id and e.kind='actual' and (e.reading_edition_id is not distinct from b.edition_id or e.reading_end_page is null)
) s on true;
revoke all on public.book_library from public,anon;
grant select on public.book_library to authenticated;

create function public.validate_reading_activity() returns trigger language plpgsql security invoker set search_path='' as $$
declare total integer; edition text; begin
 if new.media_type='book' and new.reading_end_page is not null then
  select total_pages,edition_id into total,edition from public.book_tracking where user_id=new.user_id and ol_work_id=new.provider_id;
  if new.reading_edition_id is not distinct from edition and total is not null and new.reading_end_page>total then raise exception 'Reading exceeds the selected edition page count' using errcode='23514'; end if;
 end if;
 return new;
end $$;
create trigger calendar_reading_validate before insert or update on public.calendar_entries for each row execute function public.validate_reading_activity();

create function public.save_reading_activity(p_entry jsonb,p_expected timestamptz default null,p_rating numeric default null,
 p_rating_changed boolean default false,p_update_current boolean default false,p_review text default null,p_spoilers boolean default false,p_episodes jsonb default null,p_book jsonb default '{}')
 returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved uuid; previous public.calendar_entries; current_edition text; current_book public.book_tracking; result jsonb; begin
 if (select auth.uid()) is null or p_entry->>'media_type' is distinct from 'book' then raise exception 'Owned book activity required' using errcode='42501'; end if;
 select * into previous from public.calendar_entries where id=(p_entry->>'id')::uuid and user_id=(select auth.uid());
 if coalesce((p_entry->>'library_add')::boolean,false) then
  insert into public.book_tracking(user_id,ol_work_id,title,authors,cover_url)
  values((select auth.uid()),(p_entry->>'provider_id')::integer,coalesce(p_book->>'title',p_entry->>'media_title'),coalesce(array(select jsonb_array_elements_text(p_book->'authors')),'{}'),p_entry->>'media_image') on conflict do nothing;
 end if;
 select * into current_book from public.book_tracking where user_id=(select auth.uid()) and ol_work_id=(p_entry->>'provider_id')::integer for update;
 current_edition=current_book.edition_id;
 saved=public.save_calendar_activity(p_entry,p_expected,p_rating,p_rating_changed,false,null,p_spoilers,p_episodes);
 if p_expected is null and p_entry->>'kind'='actual' then update public.book_tracking set status_explicit=false where user_id=(select auth.uid()) and ol_work_id=(p_entry->>'provider_id')::integer and status<>'finished'; end if;
 update public.calendar_entries set reading_start_page=(p_entry->>'reading_start_page')::integer,reading_end_page=(p_entry->>'reading_end_page')::integer,
  reading_edition_id=case when p_entry->>'reading_end_page' is null then null when previous.id is not null and previous.media_type='book' and previous.provider_id=(p_entry->>'provider_id')::integer and previous.reading_end_page is not null then previous.reading_edition_id else current_edition end
 where id=saved and user_id=(select auth.uid());
 if p_entry->>'kind'='actual' and p_rating_changed and p_update_current and p_rating is not null then
  update public.book_tracking set rating=p_rating where user_id=(select auth.uid()) and ol_work_id=(p_entry->>'provider_id')::integer;
 end if;
 if p_entry->>'kind'='actual' and p_review is not null then update public.book_tracking set review=p_review,contains_spoilers=p_spoilers where user_id=(select auth.uid()) and ol_work_id=(p_entry->>'provider_id')::integer; end if;
 select jsonb_build_object('id',id,'updated_at',updated_at) into result from public.calendar_entries where id=saved and user_id=(select auth.uid());
 return result;
end $$;
revoke all on function public.validate_book_tracking(),public.validate_reading_activity() from public,anon,authenticated;
revoke all on function public.save_reading_activity(jsonb,timestamptz,numeric,boolean,boolean,text,boolean,jsonb,jsonb) from public,anon;
grant execute on function public.save_reading_activity(jsonb,timestamptz,numeric,boolean,boolean,text,boolean,jsonb,jsonb) to authenticated;
commit;
