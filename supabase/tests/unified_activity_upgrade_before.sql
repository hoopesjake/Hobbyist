-- Minimal pre-008 data; used only by the isolated migration runner.
insert into auth.users(id,email) values('f1111111-1111-4111-8111-111111111111','upgrade-fixture@example.test');
insert into public.movie_tracking(user_id,tmdb_id,watched,watched_on,rating,review,on_watchlist) values
 ('f1111111-1111-4111-8111-111111111111',990001,true,'2019-01-01',4,'Existing review',true),
 ('f1111111-1111-4111-8111-111111111111',990002,true,'2019-02-01',4.5,'Represented',false),
 ('f1111111-1111-4111-8111-111111111111',990003,false,null,3,'Undated',false);
insert into public.tv_tracking(user_id,tmdb_id,status,rating) values('f1111111-1111-4111-8111-111111111111',990004,'completed',5);
insert into public.tv_episode_tracking(user_id,tmdb_show_id,season_number,episode_number,tmdb_episode_id,watched,watched_on,rating) values
 ('f1111111-1111-4111-8111-111111111111',990004,1,1,990041,true,'2019-03-01',4),
 ('f1111111-1111-4111-8111-111111111111',990004,1,2,990042,true,'2019-03-02',4.5);
insert into public.calendar_entries(user_id,kind,title,category,event_date,time_zone,media_type,provider,provider_id,media_title,season_number,episode_number) values
 ('f1111111-1111-4111-8111-111111111111','actual','Original movie memory','movies','2019-02-01','UTC','movie','tmdb',990002,'Original movie',null,null),
 ('f1111111-1111-4111-8111-111111111111','actual','Original TV memory','tv','2019-03-01','UTC','tv','tmdb',990004,'Original show',1,1);
