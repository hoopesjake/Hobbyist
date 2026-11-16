-- Disposable Supabase/PostgreSQL test only; fixtures are rolled back.
-- Requires all three migrations. Run as postgres.
begin;
insert into auth.users(id,email) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','separate-a@example.invalid'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','separate-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
insert into public.movie_tracking(user_id,tmdb_id,on_watchlist,watched,watched_on,rating,review,contains_spoilers)
values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',550,true,true,current_date-1,4.5,'A movie review',true);
-- A watchlist toggle must not overwrite the review, rating, or watched date.
insert into public.movie_tracking(user_id,tmdb_id,on_watchlist) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',550,false)
on conflict(user_id,tmdb_id) do update set user_id=excluded.user_id,tmdb_id=excluded.tmdb_id,on_watchlist=excluded.on_watchlist;
insert into public.tv_tracking(user_id,tmdb_id,status,started_on,completed_on,rating,review)
values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1396,'watching',current_date-10,null,5,'Overall show review');
-- Episode parent creation is a no-op when the show already exists.
insert into public.tv_tracking(user_id,tmdb_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1396) on conflict(user_id,tmdb_id) do nothing;
insert into public.tv_episode_tracking(user_id,tmdb_show_id,season_number,episode_number,tmdb_episode_id,watched,watched_on,rating,review,contains_spoilers)
values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1396,1,1,10001,true,current_date-2,4.5,'Episode review',true);
update public.tv_episode_tracking set rating=3,watched_on=current_date-1 where tmdb_show_id=1396 and season_number=1 and episode_number=1;
-- A quick watch toggle changes only watch fields, not the rating/review.
insert into public.tv_episode_tracking(user_id,tmdb_show_id,season_number,episode_number,tmdb_episode_id,watched,watched_on)
values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1396,1,1,10001,false,null)
on conflict(user_id,tmdb_show_id,season_number,episode_number) do update set watched=excluded.watched,watched_on=excluded.watched_on;
-- Watching without rating and rating without watching are independently supported.
insert into public.tv_episode_tracking(user_id,tmdb_show_id,season_number,episode_number,tmdb_episode_id,watched)
values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1396,1,2,10002,true);
insert into public.tv_episode_tracking(user_id,tmdb_show_id,season_number,episode_number,tmdb_episode_id,rating)
values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1396,0,1,10003,2.5);
do $$ declare result jsonb; begin
 if (select rating from public.movie_tracking where tmdb_id=550)<>4.5 or (select review from public.movie_tracking where tmdb_id=550)<>'A movie review' then raise exception 'Movie partial update overwrote rating/review'; end if;
 if not (select contains_spoilers from public.movie_tracking where tmdb_id=550) then raise exception 'Spoiler flag did not persist'; end if;
 if (select rating from public.tv_tracking where tmdb_id=1396)<>5 or (select started_on from public.tv_tracking where tmdb_id=1396)<>current_date-10 or (select completed_on from public.tv_tracking where tmdb_id=1396) is not null or (select status from public.tv_tracking where tmdb_id=1396)<>'watching' then raise exception 'Episode change overwrote show rating/status/dates'; end if;
 if (select rating from public.tv_episode_tracking where tmdb_episode_id=10001)<>3 or (select review from public.tv_episode_tracking where tmdb_episode_id=10001)<>'Episode review' then raise exception 'Quick toggle overwrote episode review'; end if;
 result:=public.media_tracking_stats();
 if (result->'movies'->>'watched')::integer<>1 or (result->>'episodes_watched')::integer<>1 then raise exception 'Statistics incorrect'; end if;
 begin update public.movie_tracking set rating=3.7 where tmdb_id=550; raise exception 'Invalid rating accepted'; exception when check_violation then null; end;
 begin update public.tv_episode_tracking set watched_on=current_date+1,watched=true where tmdb_episode_id=10001; raise exception 'Future episode date accepted'; exception when check_violation then null; end;
 begin update public.tv_tracking set completed_on=current_date-20 where tmdb_id=1396; raise exception 'Invalid show dates accepted'; exception when check_violation then null; end;
 begin update public.tv_episode_tracking set season_number=2 where tmdb_episode_id=10001; raise exception 'Episode identity changed'; exception when insufficient_privilege then null; end;
 begin update public.movie_tracking set created_at=now() where tmdb_id=550; raise exception 'Creation date editable'; exception when insufficient_privilege then null; end;
 begin update public.movie_tracking set review=repeat('x',10001) where tmdb_id=550; raise exception 'Oversized review accepted'; exception when check_violation then null; end;
 begin insert into public.viewing_entries(user_id,media_type,tmdb_id,title) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','movie',999,'Legacy write'); raise exception 'Legacy archive writable'; exception when insufficient_privilege then null; end;
end $$;
-- Explicit completion remains independent of subsequent episode ratings.
update public.tv_tracking set status='completed',completed_on=current_date where tmdb_id=1396;
update public.tv_episode_tracking set rating=4.5 where tmdb_episode_id=10002;
do $$ begin
 if (select completed_on from public.tv_tracking where tmdb_id=1396)<>current_date or (select started_on from public.tv_tracking where tmdb_id=1396)<>current_date-10 or (select rating from public.tv_tracking where tmdb_id=1396)<>5 then raise exception 'Episode rating changed explicit show completion/rating'; end if;
end $$;
-- Season-wide partial upsert must preserve dates/reviews/ratings and other seasons.
update public.tv_episode_tracking set watched=true,watched_on=current_date-2 where tmdb_episode_id=10001;
insert into public.tv_episode_tracking(user_id,tmdb_show_id,season_number,episode_number,tmdb_episode_id,watched) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1396,1,1,10001,true),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1396,1,2,10002,true),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1396,1,3,10004,true)
on conflict(user_id,tmdb_show_id,season_number,episode_number) do update set
 user_id=excluded.user_id,tmdb_show_id=excluded.tmdb_show_id,season_number=excluded.season_number,
 episode_number=excluded.episode_number,tmdb_episode_id=excluded.tmdb_episode_id,watched=excluded.watched;
do $$ begin
 if (select count(*) from public.tv_episode_tracking where season_number=1 and watched)<>3 then raise exception 'Watch all failed'; end if;
 if (select watched_on from public.tv_episode_tracking where tmdb_episode_id=10001)<>current_date-2 or (select rating from public.tv_episode_tracking where tmdb_episode_id=10001)<>3 or (select review from public.tv_episode_tracking where tmdb_episode_id=10001)<>'Episode review' then raise exception 'Watch all erased personal details'; end if;
 if (select watched_on from public.tv_episode_tracking where tmdb_episode_id=10004) is not null or (select rating from public.tv_episode_tracking where tmdb_episode_id=10004) is not null then raise exception 'Watch all invented dates/ratings'; end if;
 if (select watched from public.tv_episode_tracking where season_number=0) then raise exception 'Watch all affected a different season'; end if;
 if (select rating from public.tv_tracking where tmdb_id=1396)<>5 or (select completed_on from public.tv_tracking where tmdb_id=1396)<>current_date then raise exception 'Watch all changed overall show'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $$ declare affected integer; begin
 if exists(select 1 from public.movie_tracking) or exists(select 1 from public.tv_tracking) or exists(select 1 from public.tv_episode_tracking) then raise exception 'Cross-user private tracking leaked'; end if;
 if (public.media_tracking_stats()->'movies'->>'watched')::integer<>0 then raise exception 'Statistics leaked'; end if;
 update public.movie_tracking set rating=1 where tmdb_id=550; get diagnostics affected=row_count; if affected<>0 then raise exception 'Cross-user movie update allowed'; end if;
 delete from public.tv_tracking where tmdb_id=1396; get diagnostics affected=row_count; if affected<>0 then raise exception 'Cross-user show delete allowed'; end if;
 update public.tv_episode_tracking set rating=1 where tmdb_episode_id=10001; get diagnostics affected=row_count; if affected<>0 then raise exception 'Cross-user episode update allowed'; end if;
 begin insert into public.movie_tracking(user_id,tmdb_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',999); raise exception 'Forged movie owner accepted'; exception when insufficient_privilege then null; end;
 begin insert into public.tv_episode_tracking(user_id,tmdb_show_id,season_number,episode_number,tmdb_episode_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1396,1,9,10009); raise exception 'Forged episode owner accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 begin perform * from public.movie_tracking; raise exception 'Anonymous movie access'; exception when insufficient_privilege then null; end;
 begin perform * from public.tv_tracking; raise exception 'Anonymous show access'; exception when insufficient_privilege then null; end;
 begin perform * from public.tv_episode_tracking; raise exception 'Anonymous episode access'; exception when insufficient_privilege then null; end;
 begin perform public.media_tracking_stats(); raise exception 'Anonymous statistics access'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
delete from public.movie_tracking where tmdb_id=550;
delete from public.tv_tracking where tmdb_id=1396;
do $$ begin if exists(select 1 from public.tv_episode_tracking) then raise exception 'Explicit show removal did not remove owned episodes'; end if; end $$;
reset role;
rollback;
