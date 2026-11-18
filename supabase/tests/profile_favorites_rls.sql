-- Run as postgres against a disposable Supabase database after migrations 001-015.
-- All fixtures and changes roll back.
begin;
insert into auth.users(id,email) values
 ('11111111-aaaa-4aaa-8aaa-111111111111','fav-public@example.invalid'),
 ('22222222-aaaa-4aaa-8aaa-222222222222','fav-private@example.invalid'),
 ('33333333-aaaa-4aaa-8aaa-333333333333','fav-visitor@example.invalid');
insert into public.profiles(id,username,visibility) values
 ('11111111-aaaa-4aaa-8aaa-111111111111','fav_public_user','public'),
 ('22222222-aaaa-4aaa-8aaa-222222222222','fav_private_user','private');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-aaaa-4aaa-8aaa-111111111111',true);
do $$ declare v_order integer[]; begin
 perform public.set_profile_favorites('movie','[{"tmdb_id":550},{"tmdb_id":27205},{"tmdb_id":157336}]'::jsonb);
 if (select count(*) from public.profile_favorites where user_id='11111111-aaaa-4aaa-8aaa-111111111111' and category='movie')<>3 then raise exception 'Favorites not saved'; end if;
 select array_agg(tmdb_id order by position) into v_order from public.profile_favorites where user_id='11111111-aaaa-4aaa-8aaa-111111111111' and category='movie';
 if v_order<>array[550,27205,157336] then raise exception 'Favorite order not preserved: %', v_order; end if;
 -- Re-saving replaces the set atomically; no stale third slot survives a shorter list.
 perform public.set_profile_favorites('movie','[{"tmdb_id":27205},{"tmdb_id":550}]'::jsonb);
 if (select count(*) from public.profile_favorites where user_id='11111111-aaaa-4aaa-8aaa-111111111111' and category='movie')<>2 then raise exception 'Stale favorite slot survived replace'; end if;
 begin perform public.set_profile_favorites('movie','[{"tmdb_id":1},{"tmdb_id":2},{"tmdb_id":3},{"tmdb_id":4},{"tmdb_id":5}]'::jsonb); raise exception 'More than 4 favorites accepted'; exception when others then null; end;
 begin perform public.set_profile_favorites('person','[]'::jsonb); raise exception 'Invalid category accepted'; exception when others then null; end;
 begin insert into public.profile_favorites(user_id,category,position,tmdb_id,igdb_id) values ('11111111-aaaa-4aaa-8aaa-111111111111','game',1,550,1942); raise exception 'Favorite with two identities accepted'; exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub','22222222-aaaa-4aaa-8aaa-222222222222',true);
do $$ begin perform public.set_profile_favorites('book','[{"ol_id":42}]'::jsonb); end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 if not exists(select 1 from public.profile_favorites where user_id='11111111-aaaa-4aaa-8aaa-111111111111') then raise exception 'Anonymous cannot see public user favorites'; end if;
 if exists(select 1 from public.profile_favorites where user_id='22222222-aaaa-4aaa-8aaa-222222222222') then raise exception 'Anonymous sees private user favorites'; end if;
 begin insert into public.profile_favorites(user_id,category,position,tmdb_id) values ('11111111-aaaa-4aaa-8aaa-111111111111','movie',4,999); raise exception 'Anonymous write allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-aaaa-4aaa-8aaa-333333333333',true);
do $$ begin
 if exists(select 1 from public.profile_favorites where user_id='22222222-aaaa-4aaa-8aaa-222222222222') then raise exception 'Visitor sees private user favorites'; end if;
 -- The function always scopes to auth.uid(), so a visitor calling it can only ever write
 -- their own row set; the public user's favorites must remain exactly as they saved them.
 perform public.set_profile_favorites('movie','[{"tmdb_id":111}]'::jsonb);
 if (select tmdb_id from public.profile_favorites where user_id='11111111-aaaa-4aaa-8aaa-111111111111' and category='movie' and position=1)<>27205 then raise exception 'Owner favorites were changed by another user call'; end if;
 if not exists(select 1 from public.profile_favorites where user_id='33333333-aaaa-4aaa-8aaa-333333333333' and category='movie' and tmdb_id=111) then raise exception 'Visitor could not save their own favorites'; end if;
end $$;
reset role;
rollback;
