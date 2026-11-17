-- Local/disposable Supabase only. Run as postgres after migration 005. Rolls back fixtures.
begin;
insert into auth.users(id,email) values
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','game-owner@example.invalid'),
 ('ffffffff-ffff-4fff-8fff-ffffffffffff','game-visitor@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
insert into public.game_tracking(user_id,igdb_id,status,owned,platform_ids,manual_playtime_minutes,progress,rating,review,wishlist,to_be_played,want_to_play_more,started_on,completed_on)
values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',550,'completed',true,'{6,48}',123,100,4.5,'Private review',true,true,true,current_date-10,current_date-1);
-- The actual full-save upsert shape preserves immutable identity and is permitted.
insert into public.game_tracking(user_id,igdb_id,rating) values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',550,5)
on conflict(user_id,igdb_id) do update set user_id=excluded.user_id,igdb_id=excluded.igdb_id,rating=excluded.rating;
update public.game_tracking set wishlist=false where igdb_id=550;
do $$ begin
 if (select status from public.game_tracking where igdb_id=550)<>'completed' or not(select owned and to_be_played and want_to_play_more from public.game_tracking where igdb_id=550) then raise exception 'Game ownership/status/queues are not independent'; end if;
 if (select manual_playtime_minutes from public.game_tracking where igdb_id=550)<>123 or (select review from public.game_tracking where igdb_id=550)<>'Private review' then raise exception 'Partial action erased personal data'; end if;
 begin update public.game_tracking set igdb_id=2 where igdb_id=550;raise exception 'Game identity editable';exception when check_violation then null;end;
 begin update public.game_tracking set platform_ids='{6,6}' where igdb_id=550;raise exception 'Duplicate platform accepted';exception when check_violation then null;end;
 begin update public.game_tracking set platform_ids='{0}' where igdb_id=550;raise exception 'Invalid platform accepted';exception when check_violation then null;end;
 begin update public.game_tracking set rating=3.7 where igdb_id=550;raise exception 'Invalid game rating';exception when check_violation then null;end;
 begin update public.game_tracking set completed_on=current_date+1 where igdb_id=550;raise exception 'Future date accepted';exception when check_violation then null;end;
 begin update public.game_tracking set manual_playtime_minutes=-1 where igdb_id=550;raise exception 'Negative playtime accepted';exception when check_violation then null;end;
end $$;
reset role;
insert into public.media_lists(id,user_id,name,visibility,description) values('33333333-3333-4333-8333-333333333333','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Mixed games','public','Movie, show, game');
set local role authenticated;
insert into public.media_list_items(list_id,media_type,tmdb_id) values('33333333-3333-4333-8333-333333333333','movie',550),('33333333-3333-4333-8333-333333333333','tv',550);
insert into public.media_list_items(list_id,media_type,igdb_id) values('33333333-3333-4333-8333-333333333333','game',550);
select public.move_media_list_item('33333333-3333-4333-8333-333333333333','game',550,-1);
do $$ begin
 if (select count(*) from public.media_list_items where list_id='33333333-3333-4333-8333-333333333333')<>3 then raise exception 'Mixed identities collided';end if;
 if (select media_type from public.media_list_items where list_id='33333333-3333-4333-8333-333333333333' order by position offset 1 limit 1)<>'game' then raise exception 'Reordering failed';end if;
 begin insert into public.media_list_items(list_id,media_type,igdb_id) values('33333333-3333-4333-8333-333333333333','game',550);raise exception 'Duplicate game in list';exception when unique_violation then null;end;
 begin insert into public.media_list_items(list_id,media_type,tmdb_id,igdb_id) values('33333333-3333-4333-8333-333333333333','game',1,2);raise exception 'Mixed provider identity accepted';exception when check_violation then null;end;
end $$;
select set_config('request.jwt.claim.sub','ffffffff-ffff-4fff-8fff-ffffffffffff',true);
do $$ declare affected integer;begin
 if exists(select 1 from public.game_tracking where igdb_id=550) then raise exception 'Private gaming data leaked';end if;
 update public.game_tracking set manual_playtime_minutes=999 where igdb_id=550;get diagnostics affected=row_count;if affected<>0 then raise exception 'Cross-user game update';end if;
 delete from public.game_tracking where igdb_id=550;get diagnostics affected=row_count;if affected<>0 then raise exception 'Cross-user game deletion';end if;
 begin insert into public.game_tracking(user_id,igdb_id) values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',1);raise exception 'Forged game owner accepted';exception when insufficient_privilege then null;end;
 begin perform public.move_media_list_item('33333333-3333-4333-8333-333333333333','game',550,-1);raise exception 'Cross-user reordering allowed';exception when insufficient_privilege then null;end;
 begin insert into public.media_list_items(list_id,media_type,igdb_id) values('33333333-3333-4333-8333-333333333333','game',1);raise exception 'Cross-user game list insert';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 if (select description from public.media_lists where id='33333333-3333-4333-8333-333333333333')<>'Movie, show, game' then raise exception 'Public description unavailable';end if;
 if (select count(*) from public.media_list_items where list_id='33333333-3333-4333-8333-333333333333')<>3 then raise exception 'Public mixed list unavailable';end if;
 begin perform * from public.game_tracking;raise exception 'Anonymous gaming data access';exception when insufficient_privilege then null;end;
 begin perform public.move_media_list_item('33333333-3333-4333-8333-333333333333','game',550,-1);raise exception 'Anonymous reorder allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
update public.media_lists set visibility='private' where id='33333333-3333-4333-8333-333333333333';
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin if exists(select 1 from public.media_list_items where list_id='33333333-3333-4333-8333-333333333333') then raise exception 'Private game list leaked';end if;end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
delete from public.media_lists where id='33333333-3333-4333-8333-333333333333';
do $$ begin if not exists(select 1 from public.game_tracking where igdb_id=550) then raise exception 'List deletion erased game tracking';end if;end $$;
rollback;
