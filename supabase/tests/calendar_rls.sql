-- Run only in an isolated development database, after migrations 001–006.
-- All fixtures are rolled back. Never use a production database for this test.
begin;
insert into auth.users(id,email,created_at) values
 ('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','calendar-owner@example.test',now()),
 ('cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','calendar-other@example.test',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
insert into public.movie_tracking(user_id,tmdb_id,on_watchlist) values('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',550,true);
insert into public.tv_tracking(user_id,tmdb_id,status) values('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',550,'watching');
insert into public.game_tracking(user_id,igdb_id,manual_playtime_minutes) values('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',550,120);
insert into public.calendar_entries(id,user_id,kind,status,title,category,event_date,time_zone,duration_minutes,notes,media_type,provider,provider_id,media_title)
values('c1111111-1111-4111-8111-111111111111','caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','plan','planned','Plan Cyberpunk','games','2099-11-21','America/Denver',60,'Private plan','game','igdb',550,'Cyberpunk');
insert into public.calendar_entries(id,user_id,kind,plan_id,title,category,event_date,time_zone,duration_minutes,approximate,notes)
values('c2222222-2222-4222-8222-222222222222','caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','actual','c1111111-1111-4111-8111-111111111111','Actually played Fortnite','games','2020-11-21','America/Denver',120,true,'A private win with friends.');
do $$ begin
 if (select status from public.calendar_entries where id='c1111111-1111-4111-8111-111111111111') <> 'completed' then raise exception 'Plan was not completed atomically'; end if;
 if (select title from public.calendar_entries where id='c1111111-1111-4111-8111-111111111111') <> 'Plan Cyberpunk' then raise exception 'Original plan overwritten'; end if;
 if (select sum(duration_minutes) from public.calendar_entries where kind='actual') <> 120 then raise exception 'Planned duration counted as actual'; end if;
 if (select manual_playtime_minutes from public.game_tracking where igdb_id=550) <> 120 then raise exception 'Calendar changed tracked game playtime'; end if;
 if not (select on_watchlist from public.movie_tracking where tmdb_id=550) then raise exception 'Calendar changed movie tracking'; end if;
 begin
  insert into public.calendar_entries(user_id,kind,plan_id,title,category,event_date,time_zone) values('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','actual','c1111111-1111-4111-8111-111111111111','Duplicate','games','2020-11-21','UTC');
  raise exception 'Duplicate actual log accepted';
 exception when unique_violation then null; end;
 begin
  insert into public.calendar_entries(user_id,kind,title,category,event_date,time_zone,media_type,provider,provider_id,media_title) values('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','actual','Wrong library','movies','2020-11-21','UTC','movie','tmdb',999999,'Not owned');
  raise exception 'Non-library media accepted';
 exception when check_violation then null; end;
 begin
  update public.calendar_entries set privacy='public' where id='c2222222-2222-4222-8222-222222222222';
  raise exception 'Private memories made public';
 exception when check_violation then null; end;
 begin
  insert into public.calendar_entries(user_id,kind,title,category,event_date,time_zone) values('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','actual','Future','other','2099-01-01','UTC');
  raise exception 'Future actual activity accepted';
 exception when check_violation then null; end;
end $$;
-- Editing notes and changing a media association update one existing row.
update public.calendar_entries set notes='Edited memory',category='movies',media_type='movie',provider='tmdb',provider_id=550,media_title='Movie night' where id='c2222222-2222-4222-8222-222222222222';
update public.calendar_entries set category='tv',media_type='tv',provider='tmdb',provider_id=550,media_title='TV night',season_number=0,episode_number=1 where id='c2222222-2222-4222-8222-222222222222';
-- Correct elapsed duration across the Denver spring transition is one hour.
insert into public.calendar_entries(id,user_id,kind,title,category,event_date,start_time,end_date,end_time,time_zone,starts_at,ends_at,duration_minutes)
values('c3333333-3333-4333-8333-333333333333','caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','actual','Spring clocks','other','2020-03-08','01:30','2020-03-08','03:30','America/Denver','2020-03-08T08:30Z','2020-03-08T09:30Z',60);
do $$ begin
 if (select count(*) from public.calendar_entries) <> 3 then raise exception 'Editing duplicated records'; end if;
 begin
  update public.calendar_entries set start_time='02:30' where id='c3333333-3333-4333-8333-333333333333';
  raise exception 'DST gap was silently normalized';
 exception when check_violation then null; end;
 begin
  update public.calendar_entries set kind='plan',status='planned' where id='c2222222-2222-4222-8222-222222222222';
  raise exception 'Actual kind was overwritten';
 exception when insufficient_privilege then null; end;
end $$;
-- A second user cannot see, update, delete, forge ownership or attach to a plan.
select set_config('request.jwt.claim.sub','cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $$ declare affected integer; begin
 if exists(select 1 from public.calendar_entries) then raise exception 'Private activity leaked'; end if;
 update public.calendar_entries set notes='Hijacked'; get diagnostics affected=row_count; if affected<>0 then raise exception 'Cross-owner update'; end if;
 delete from public.calendar_entries; get diagnostics affected=row_count; if affected<>0 then raise exception 'Cross-owner deletion'; end if;
 begin
  insert into public.calendar_entries(user_id,kind,title,category,event_date,time_zone) values('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','actual','Forged','other','2020-01-01','UTC');
  raise exception 'Forged ownership accepted';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.calendar_entries(user_id,kind,plan_id,title,category,event_date,time_zone) values('cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','actual','c1111111-1111-4111-8111-111111111111','Stolen plan','other','2020-01-01','UTC');
  raise exception 'Cross-owner plan association';
 exception when check_violation then null; end;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 begin perform * from public.calendar_entries; raise exception 'Anonymous read allowed'; exception when insufficient_privilege then null; end;
 begin delete from public.calendar_entries; raise exception 'Anonymous deletion allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
delete from public.calendar_entries where id='c1111111-1111-4111-8111-111111111111';
do $$ begin
 if (select plan_id from public.calendar_entries where id='c2222222-2222-4222-8222-222222222222') is not null then raise exception 'Deleted plan left a dangling association'; end if;
 if (select notes from public.calendar_entries where id='c2222222-2222-4222-8222-222222222222') <> 'Edited memory' then raise exception 'Plan deletion erased actual memory'; end if;
end $$;
-- Untracking a library item must not erase or prevent editing old memories.
delete from public.tv_tracking where tmdb_id=550;
update public.calendar_entries set notes='' where id='c2222222-2222-4222-8222-222222222222';
delete from public.calendar_entries where id in ('c2222222-2222-4222-8222-222222222222','c3333333-3333-4333-8333-333333333333');
do $$ begin if exists(select 1 from public.calendar_entries) then raise exception 'Owner deletion failed'; end if; end $$;
rollback;
