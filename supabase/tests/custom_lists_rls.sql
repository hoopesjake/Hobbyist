-- Run as postgres against a disposable Supabase database after migrations 001-004.
-- All fixtures and changes roll back.
begin;
insert into auth.users(id,email) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','lists-owner@example.invalid'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','lists-visitor@example.invalid');
insert into public.media_lists(id,user_id,name,visibility) values
 ('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc','Private picks','private'),
 ('22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc','Public picks','public');
insert into public.media_list_items(list_id,media_type,tmdb_id) values
 ('11111111-1111-4111-8111-111111111111','movie',550),
 ('22222222-2222-4222-8222-222222222222','movie',550),
 ('22222222-2222-4222-8222-222222222222','tv',550);
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 if (select count(id) from public.media_lists where id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'))<>1 then raise exception 'Anonymous private list leak'; end if;
 if (select count(*) from public.media_list_items where list_id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'))<>2 then raise exception 'Anonymous private items leaked or public items hidden'; end if;
 begin perform user_id from public.media_lists; raise exception 'Anonymous owner identity leak'; exception when insufficient_privilege then null; end;
 begin insert into public.media_list_items(list_id,media_type,tmdb_id) values('22222222-2222-4222-8222-222222222222','movie',1); raise exception 'Anonymous write allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
do $$ declare affected integer; begin
 if exists(select 1 from public.media_lists where id='11111111-1111-4111-8111-111111111111') then raise exception 'Other user sees private list'; end if;
 begin insert into public.media_lists(user_id,name) values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Forged owner'); raise exception 'Forged list owner accepted'; exception when insufficient_privilege then null; end;
 begin insert into public.media_list_items(list_id,media_type,tmdb_id) values('22222222-2222-4222-8222-222222222222','movie',1); raise exception 'Other user adds public item'; exception when insufficient_privilege then null; end;
 update public.media_lists set visibility='public' where id='11111111-1111-4111-8111-111111111111'; get diagnostics affected=row_count; if affected<>0 then raise exception 'Other user changes private list'; end if;
 update public.media_lists set name='Hijacked' where id='22222222-2222-4222-8222-222222222222'; get diagnostics affected=row_count; if affected<>0 then raise exception 'Other user edits public list'; end if;
 delete from public.media_list_items where list_id='22222222-2222-4222-8222-222222222222'; get diagnostics affected=row_count; if affected<>0 then raise exception 'Other user removes public items'; end if;
end $$;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
do $$ begin
 if (select count(id) from public.media_lists where id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'))<>2 then raise exception 'Owner cannot read both lists'; end if;
 begin insert into public.media_list_items(list_id,media_type,tmdb_id) values('22222222-2222-4222-8222-222222222222','movie',550); raise exception 'Duplicate item allowed'; exception when unique_violation then null; end;
 begin insert into public.media_list_items(list_id,media_type,tmdb_id) values('22222222-2222-4222-8222-222222222222','person',1); raise exception 'Person allowed in list'; exception when check_violation then null; end;
 begin update public.media_lists set name='' where id='22222222-2222-4222-8222-222222222222'; raise exception 'Blank name accepted'; exception when check_violation then null; end;
 begin update public.media_lists set user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd' where id='22222222-2222-4222-8222-222222222222'; raise exception 'Owner changed identity'; exception when insufficient_privilege then null; end;
end $$;
update public.media_lists set name='Renamed',visibility='private' where id='22222222-2222-4222-8222-222222222222';
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 if exists(select 1 from public.media_lists where id='22222222-2222-4222-8222-222222222222') or exists(select 1 from public.media_list_items where list_id='22222222-2222-4222-8222-222222222222') then raise exception 'Privacy toggle did not hide list/items'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
delete from public.media_lists where id='22222222-2222-4222-8222-222222222222';
reset role;
do $$ begin
 if exists(select 1 from public.media_list_items where list_id='22222222-2222-4222-8222-222222222222') then raise exception 'List deletion did not cascade'; end if;
end $$;
rollback;
