-- Isolated development database only. All fixtures roll back.
begin;
insert into auth.users(id,email,created_at) values
 ('d1111111-1111-4111-8111-111111111111','calendar-library@example.test',now()),
 ('d2222222-2222-4222-8222-222222222222','calendar-library-other@example.test',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','d1111111-1111-4111-8111-111111111111',true);
-- Six brand-new items: plans and actual logs have different initial statuses.
insert into public.calendar_entries(user_id,kind,status,title,category,event_date,time_zone,media_type,provider,provider_id,media_title,library_add,media_image) values
 ('d1111111-1111-4111-8111-111111111111','plan','planned','Hunger Games night','movies','2099-11-21','UTC','movie','tmdb',777701,'The Hunger Games',true,'https://image.tmdb.org/t/p/w342/poster.jpg'),
 ('d1111111-1111-4111-8111-111111111111','actual',null,'Watched a movie','movies','2020-11-21','UTC','movie','tmdb',777702,'A Movie',true,null),
 ('d1111111-1111-4111-8111-111111111111','plan','planned','Plan a show','tv','2099-11-21','UTC','tv','tmdb',777703,'A Show',true,null),
 ('d1111111-1111-4111-8111-111111111111','actual',null,'Watched a show','tv','2020-11-21','UTC','tv','tmdb',777704,'A Show',true,null),
 ('d1111111-1111-4111-8111-111111111111','plan','planned','Plan a game','games','2099-11-21','UTC','game','igdb',777705,'A Game',true,null),
 ('d1111111-1111-4111-8111-111111111111','actual',null,'Played a game','games','2020-11-21','UTC','game','igdb',777706,'A Game',true,null);
do $$ begin
 if not exists(select 1 from public.movie_tracking where tmdb_id=777701 and on_watchlist and not watched and watched_on is null) then raise exception 'Plan not added to watchlist'; end if;
 if not exists(select 1 from public.movie_tracking where tmdb_id=777702 and watched and not on_watchlist and watched_on='2020-11-21') then raise exception 'Actual movie not marked watched'; end if;
 if not exists(select 1 from public.tv_tracking where tmdb_id=777703 and status='planned' and started_on is null) then raise exception 'TV plan not added'; end if;
 if not exists(select 1 from public.tv_tracking where tmdb_id=777704 and status='watching' and started_on='2020-11-21') then raise exception 'TV actual not watching'; end if;
 if not exists(select 1 from public.game_tracking where igdb_id=777705 and status='backlog' and manual_playtime_minutes is null) then raise exception 'Game plan not backlog'; end if;
 if not exists(select 1 from public.game_tracking where igdb_id=777706 and status='playing' and last_played_on='2020-11-21' and manual_playtime_minutes is null) then raise exception 'Game actual not playing'; end if;
end $$;
-- Existing watchlists/backlogs advance on an actual log, without losing reviews,
-- ratings, manual playtime or completed history.
update public.tv_tracking set review='Keep TV notes',rating=4 where tmdb_id=777703;
update public.game_tracking set review='Keep game notes',rating=4.5,manual_playtime_minutes=333 where igdb_id=777705;
update public.game_tracking set status='completed',completed_on='2020-11-21' where igdb_id=777706;
insert into public.calendar_entries(user_id,kind,title,category,event_date,time_zone,media_type,provider,provider_id,media_title,library_add) values
 ('d1111111-1111-4111-8111-111111111111','actual','Start planned show','tv','2020-11-22','UTC','tv','tmdb',777703,'A Show',true),
 ('d1111111-1111-4111-8111-111111111111','actual','Play backlog game','games','2020-11-22','UTC','game','igdb',777705,'A Game',true),
 ('d1111111-1111-4111-8111-111111111111','actual','Revisit completed game','games','2020-11-22','UTC','game','igdb',777706,'A Game',true);
do $$ begin
 if not exists(select 1 from public.tv_tracking where tmdb_id=777703 and status='watching' and review='Keep TV notes' and rating=4) then raise exception 'TV progress erased personal fields'; end if;
 if not exists(select 1 from public.game_tracking where igdb_id=777705 and status='playing' and review='Keep game notes' and rating=4.5 and manual_playtime_minutes=333) then raise exception 'Game progress erased personal fields'; end if;
 if not exists(select 1 from public.game_tracking where igdb_id=777706 and status='completed' and completed_on='2020-11-21') then raise exception 'Completed history was reset'; end if;
end $$;
-- Later calendar records never reset an existing rating, review, date or status.
update public.movie_tracking set rating=4.5,review='Keep this review',watched=true,watched_on='2020-01-01',on_watchlist=false where tmdb_id=777701;
insert into public.calendar_entries(user_id,kind,status,title,category,event_date,time_zone,media_type,provider,provider_id,media_title,library_add)
values('d1111111-1111-4111-8111-111111111111','plan','planned','Another plan','movies','2099-11-22','UTC','movie','tmdb',777701,'The Hunger Games',true);
insert into public.calendar_entries(user_id,kind,title,category,event_date,time_zone,media_type,provider,provider_id,media_title,library_add)
values('d1111111-1111-4111-8111-111111111111','actual','Rewatched movie','movies','2020-11-22','UTC','movie','tmdb',777701,'The Hunger Games',true);
do $$ begin
 if not exists(select 1 from public.movie_tracking where tmdb_id=777701 and rating=4.5 and review='Keep this review' and watched_on='2020-01-01' and not on_watchlist) then raise exception 'Existing movie data overwritten'; end if;
 -- The library addition must roll back when the activity fails validation.
 begin
  insert into public.calendar_entries(user_id,kind,status,title,category,event_date,time_zone,media_type,provider,provider_id,media_title,library_add)
  values('d1111111-1111-4111-8111-111111111111','plan','planned','','movies','2099-11-22','UTC','movie','tmdb',777799,'Must roll back',true);
  raise exception 'Invalid activity saved';
 exception when check_violation then null; end;
 if exists(select 1 from public.movie_tracking where tmdb_id=777799) then raise exception 'Orphan library entry after failed save'; end if;
 begin
  insert into public.calendar_entries(user_id,kind,status,title,category,event_date,time_zone,media_type,provider,provider_id,media_title,library_add,media_image)
  values('d1111111-1111-4111-8111-111111111111','plan','planned','Bad cover','movies','2099-11-22','UTC','movie','tmdb',777798,'Bad image',true,'https://untrusted.test/image.jpg');
  raise exception 'Untrusted cover accepted';
 exception when check_violation then null; end;
 if exists(select 1 from public.movie_tracking where tmdb_id=777798) then raise exception 'Failed image check left orphan'; end if;
end $$;
select set_config('request.jwt.claim.sub','d2222222-2222-4222-8222-222222222222',true);
do $$ begin
 if exists(select 1 from public.calendar_entries) or exists(select 1 from public.movie_tracking) or exists(select 1 from public.game_tracking) then raise exception 'Calendar library entries leaked'; end if;
 begin
  insert into public.calendar_entries(user_id,kind,status,title,category,event_date,time_zone,media_type,provider,provider_id,media_title,library_add)
  values('d1111111-1111-4111-8111-111111111111','plan','planned','Forged','movies','2099-11-22','UTC','movie','tmdb',777797,'Forged',true);
  raise exception 'Forged library insertion allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
