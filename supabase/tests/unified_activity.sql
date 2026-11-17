-- Real PostgreSQL acceptance tests; fixtures and all changes roll back.
begin;
insert into auth.users(id,email) values
 ('e1111111-1111-4111-8111-111111111111','unified-owner@example.test'),
 ('e2222222-2222-4222-8222-222222222222','unified-other@example.test');
create function pg_temp.activity(i uuid,t text,m integer,k text default 'actual',d date default '2020-11-15') returns jsonb language sql as $$
 select jsonb_build_object('id',i,'kind',k,'status',case when k='plan' then 'planned' else null end,'title','Fixture activity','category',case t when 'movie' then 'movies' when 'game' then 'games' else 'tv' end,'event_date',d,'time_zone','UTC','media_type',t,'provider',case when t='game' then 'igdb' else 'tmdb' end,'provider_id',m,'media_title','Fixture title','library_add',true,'notes','','participants','','approximate',false)
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','e1111111-1111-4111-8111-111111111111',true);
-- Schedule, complete, rate and remember. No extra viewing from tracking triggers.
select public.save_calendar_activity(pg_temp.activity('eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','movie',880001,'plan','2099-11-21'));
do $$ begin
 if not exists(select 1 from public.movie_tracking where tmdb_id=880001 and on_watchlist and not watched and rating is null and watched_on is null) then raise exception 'Scheduling changed watched/rating'; end if;
end $$;
select public.save_calendar_activity(pg_temp.activity('ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','movie',880001)||jsonb_build_object('plan_id','eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','notes','Private theater memory'),null,4,true,true,'Public review',true);
do $$ begin
 if (select count(*) from public.calendar_entries where media_type='movie' and kind='actual' and provider_id=880001)<>1 then raise exception 'Duplicate completed viewing'; end if;
 if not exists(select 1 from public.movie_tracking where tmdb_id=880001 and watched and not on_watchlist and watched_on='2020-11-15' and rating=4 and review='Public review' and contains_spoilers) then raise exception 'Movie synchronization failed'; end if;
 if not exists(select 1 from public.calendar_entries where id='eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and status='completed') then raise exception 'Plan unfinished'; end if;
end $$;
-- Rewatch snapshot, current rating, original date, blank rating preservation.
select public.save_calendar_activity(pg_temp.activity('eccccccc-cccc-4ccc-8ccc-cccccccccccc','movie',880001,'actual','2021-03-12'),null,4.5,true,true);
do $$ declare stamp timestamptz; begin
 if not exists(select 1 from public.calendar_entries where id='ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and session_rating=4) then raise exception 'Original snapshot rewritten'; end if;
 if not exists(select 1 from public.movie_tracking where tmdb_id=880001 and rating=4.5 and watched_on='2020-11-15') then raise exception 'Rewatch erased primary viewing date'; end if;
 select updated_at into stamp from public.calendar_entries where id='ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 perform public.save_calendar_activity(jsonb_build_object('id','ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),stamp,3.5,true,false);
 if (select rating from public.movie_tracking where tmdb_id=880001)<>4.5 then raise exception 'Historical edit changed current rating'; end if;
 select updated_at into stamp from public.calendar_entries where id='eccccccc-cccc-4ccc-8ccc-cccccccccccc';
 perform public.save_calendar_activity(jsonb_build_object('id','eccccccc-cccc-4ccc-8ccc-cccccccccccc','notes','Edited memory'),stamp,null,false,true);
 if (select session_rating from public.calendar_entries where id='eccccccc-cccc-4ccc-8ccc-cccccccccccc')<>4.5 then raise exception 'Blank erased rating'; end if;
 begin
  perform public.save_calendar_activity(jsonb_build_object('id','eccccccc-cccc-4ccc-8ccc-cccccccccccc','notes','Stale'),stamp);
  raise exception 'Stale write accepted';
 exception when serialization_failure then null; end;
end $$;
-- Two independently rated episodes in one session; show rating is independent.
insert into public.tv_tracking(user_id,tmdb_id,status,rating) values('e1111111-1111-4111-8111-111111111111',880002,'planned',2);
select public.save_calendar_activity(pg_temp.activity('eddddddd-dddd-4ddd-8ddd-dddddddddddd','tv',880002),null,null,false,false,null,false,
 '[{"season_number":1,"episode_number":3,"tmdb_episode_id":883003,"rating":4,"rating_changed":true,"update_current":true},{"season_number":1,"episode_number":4,"tmdb_episode_id":883004,"rating":4.5,"rating_changed":true,"update_current":true}]');
do $$ begin
 if (select count(*) from public.tv_episode_tracking where tmdb_show_id=880002 and watched and watched_on='2020-11-15')<>2 then raise exception 'Episodes not watched'; end if;
 if (select rating from public.tv_episode_tracking where tmdb_episode_id=883003)<>4 or (select rating from public.tv_episode_tracking where tmdb_episode_id=883004)<>4.5 then raise exception 'Episode ratings lost'; end if;
 if not exists(select 1 from public.tv_tracking where tmdb_id=880002 and status='watching' and rating=2) then raise exception 'Show rating/status incorrect'; end if;
 if (select count(*) from public.calendar_entries where provider_id=880002 and kind='actual')<>1 then raise exception 'Multi-episode session duplicated'; end if;
end $$;
-- Dated library -> calendar, rating-only changes -> no invented history/snapshots.
insert into public.movie_tracking(user_id,tmdb_id,watched,watched_on,rating) values('e1111111-1111-4111-8111-111111111111',880003,true,'2020-01-01',5);
update public.movie_tracking set rating=4 where tmdb_id=880003;
do $$ begin
 if (select count(*) from public.calendar_entries where provider_id=880003)<>1 or exists(select 1 from public.calendar_entries where provider_id=880003 and session_rating is not null) then raise exception 'Library rating fabricated dated rating'; end if;
end $$;
insert into public.tv_episode_tracking(user_id,tmdb_show_id,season_number,episode_number,tmdb_episode_id,watched,watched_on,rating)
 values('e1111111-1111-4111-8111-111111111111',880002,1,5,883005,true,'2020-11-16',3);
do $$ begin
 if (select count(*) from public.calendar_entries where episodes @> '[{"tmdb_episode_id":883005}]')<>1 then raise exception 'Dated episode absent'; end if;
end $$;
-- Changed plans, edited/deleted totals; manual hours and completed status survive.
insert into public.game_tracking(user_id,igdb_id,status,manual_playtime_minutes) values('e1111111-1111-4111-8111-111111111111',880004,'completed',333);
select public.save_calendar_activity(pg_temp.activity('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','game',880005,'plan','2099-11-21')||'{"duration_minutes":60}');
select public.save_calendar_activity(pg_temp.activity('efffffff-ffff-4fff-8fff-ffffffffffff','game',880004)||'{"duration_minutes":120,"approximate":true,"plan_id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"}');
do $$ declare stamp timestamptz; begin
 if (select coalesce(sum(duration_minutes),0) from public.calendar_entries where provider_id=880005 and kind='actual')<>0 then raise exception 'Planned game received actual hours'; end if;
 select updated_at into stamp from public.calendar_entries where id='efffffff-ffff-4fff-8fff-ffffffffffff';
 perform public.save_calendar_activity('{"id":"efffffff-ffff-4fff-8fff-ffffffffffff","duration_minutes":180}',stamp);
 if (select sum(duration_minutes) from public.calendar_entries where provider_id=880004 and kind='actual')<>180 then raise exception 'Session edit double counted'; end if;
 delete from public.calendar_entries where id='efffffff-ffff-4fff-8fff-ffffffffffff';
 if (select coalesce(sum(duration_minutes),0) from public.calendar_entries where provider_id=880004 and kind='actual')<>0 then raise exception 'Deleted session counted'; end if;
 if not exists(select 1 from public.game_tracking where igdb_id=880004 and status='completed' and manual_playtime_minutes=333) then raise exception 'Game manual history changed'; end if;
 -- Failure in episode progress must roll back the activity and current rating too.
 begin
  perform public.save_calendar_activity(pg_temp.activity('e9999999-9999-4999-8999-999999999999','tv',880002),null,5,true,true,null,false,
    '[{"season_number":1,"episode_number":6,"tmdb_episode_id":883003}]');
  raise exception 'Conflicting episode accepted';
 exception when unique_violation then null; end;
 if exists(select 1 from public.calendar_entries where id='e9999999-9999-4999-8999-999999999999') or (select rating from public.tv_tracking where tmdb_id=880002)<>2 then raise exception 'Partial activity save'; end if;
end $$;
-- Unrated sessions, explicit later rating edits and deletion preserve other data.
select public.save_calendar_activity(pg_temp.activity('e8888888-8888-4888-8888-888888888888','movie',880001,'actual','2020-10-01'));
delete from public.calendar_entries where id='e8888888-8888-4888-8888-888888888888';
do $$ begin
 if (select rating from public.movie_tracking where tmdb_id=880001)<>4.5 then raise exception 'Unrated/deleted log erased current rating'; end if;
end $$;
-- Episode rewatch snapshots remain independent of current episode/show ratings.
select public.save_calendar_activity(pg_temp.activity('e6666666-6666-4666-8666-666666666666','tv',880002,'actual','2022-01-01'),null,null,false,false,null,false,
 '[{"season_number":1,"episode_number":3,"tmdb_episode_id":883003,"rating":3,"rating_changed":true,"update_current":true},{"season_number":1,"episode_number":4,"tmdb_episode_id":883004,"rating":3.5,"rating_changed":true,"update_current":true}]');
update public.tv_episode_tracking set rating=5 where tmdb_episode_id=883004;
do $$ declare stamp timestamptz; begin
 if not exists(select 1 from public.calendar_entries where id='eddddddd-dddd-4ddd-8ddd-dddddddddddd' and episodes @> '[{"tmdb_episode_id":883003,"rating":4},{"tmdb_episode_id":883004,"rating":4.5}]') then raise exception 'Original episode snapshots rewritten'; end if;
 if not exists(select 1 from public.calendar_entries where id='e6666666-6666-4666-8666-666666666666' and episodes @> '[{"tmdb_episode_id":883004,"rating":3.5}]') then raise exception 'Library edit rewrote historical episode rating'; end if;
 select updated_at into stamp from public.calendar_entries where id='eddddddd-dddd-4ddd-8ddd-dddddddddddd';
 perform public.save_calendar_activity('{"id":"eddddddd-dddd-4ddd-8ddd-dddddddddddd"}',stamp,null,false,false,null,false,
  '[{"season_number":1,"episode_number":3,"tmdb_episode_id":883003,"rating":2,"rating_changed":true,"update_current":false},{"season_number":1,"episode_number":4,"tmdb_episode_id":883004}]');
 if (select rating from public.tv_episode_tracking where tmdb_episode_id=883003)<>3 then raise exception 'Historical episode edit changed current rating'; end if;
 if not exists(select 1 from public.calendar_entries where id='eddddddd-dddd-4ddd-8ddd-dddddddddddd' and episodes @> '[{"tmdb_episode_id":883004,"rating":4.5}]') then raise exception 'Unedited snapshot was cleared'; end if;
end $$;
-- Date provenance: edits follow calendar-owned dates, never erase manual dates.
select public.save_calendar_activity(pg_temp.activity('e7777777-7777-4777-8777-777777777777','movie',880007));
do $$ declare stamp timestamptz; begin
 select updated_at into stamp from public.calendar_entries where id='e7777777-7777-4777-8777-777777777777';
 perform public.save_calendar_activity('{"id":"e7777777-7777-4777-8777-777777777777","event_date":"2020-11-14"}',stamp);
 if not exists(select 1 from public.movie_tracking where tmdb_id=880007 and watched_on='2020-11-14' and watched_activity_id='e7777777-7777-4777-8777-777777777777') then raise exception 'Calendar date correction not synchronized'; end if;
 update public.movie_tracking set watched_on='2020-11-13' where tmdb_id=880007;
 if (select count(*) from public.calendar_entries where provider_id=880007)<>1 or (select event_date from public.calendar_entries where id='e7777777-7777-4777-8777-777777777777')<>'2020-11-13' then raise exception 'Library date correction duplicated history'; end if;
 select updated_at into stamp from public.calendar_entries where id='e7777777-7777-4777-8777-777777777777';
 perform public.save_calendar_activity('{"id":"e7777777-7777-4777-8777-777777777777","event_date":"2020-11-12"}',stamp);
 if (select watched_on from public.movie_tracking where tmdb_id=880007)<>'2020-11-13' then raise exception 'Explicit manual date overwritten'; end if;
 -- Removing a linked episode preserves its primary tracking, while relinquishing source ownership.
 select updated_at into stamp from public.calendar_entries where id='eddddddd-dddd-4ddd-8ddd-dddddddddddd';
 perform public.save_calendar_activity('{"id":"eddddddd-dddd-4ddd-8ddd-dddddddddddd","event_date":"2020-11-14"}',stamp);
 if (select watched_on from public.tv_episode_tracking where tmdb_episode_id=883003)<>'2020-11-14' then raise exception 'Episode date correction failed'; end if;
 select updated_at into stamp from public.calendar_entries where id='eddddddd-dddd-4ddd-8ddd-dddddddddddd';
 perform public.save_calendar_activity('{"id":"eddddddd-dddd-4ddd-8ddd-dddddddddddd"}',stamp,null,false,false,null,false,'[]');
 if exists(select 1 from public.tv_episode_tracking where tmdb_show_id=880002 and watched_activity_id='eddddddd-dddd-4ddd-8ddd-dddddddddddd') then raise exception 'Removed episode kept incorrect source'; end if;
end $$;
-- Other owners cannot see or alter sessions, snapshots or memories through RPC.
select set_config('request.jwt.claim.sub','e2222222-2222-4222-8222-222222222222',true);
do $$ begin
 if exists(select 1 from public.calendar_entries) then raise exception 'Private session leaked'; end if;
 begin
  perform public.save_calendar_activity('{"id":"ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","notes":"Forged"}','2020-01-01');
  raise exception 'Other owner edited session';
 exception when serialization_failure then null; end;
end $$;
reset role;
rollback;
