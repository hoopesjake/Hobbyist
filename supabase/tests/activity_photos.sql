-- Storage HTTP operations are separate; these exercise actual table/RLS policies.
begin;
insert into auth.users(id,email) values('a3333333-3333-4333-8333-333333333333','photos-owner@example.test'),('a4444444-4444-4444-8444-444444444444','photos-other@example.test');
-- Simulate an unrelated legacy permissive policy; bucket-specific restrictive
-- policies must still prevent unauthorized photo access and unreserved writes.
create policy test_legacy_storage_allow on storage.objects for all to authenticated,anon using(true) with check(true);
grant select on storage.objects to anon;
set local role authenticated;
select set_config('request.jwt.claim.sub','a3333333-3333-4333-8333-333333333333',true);
insert into public.movie_tracking(user_id,tmdb_id) values('a3333333-3333-4333-8333-333333333333',123123);
insert into public.calendar_entries(id,user_id,kind,title,category,event_date,time_zone,media_type,provider,provider_id,media_title) values
 ('a5555555-5555-4555-8555-555555555555','a3333333-3333-4333-8333-333333333333','actual','Photo memory','movies','2020-01-01','UTC','movie','tmdb',123123,'Movie');
do $$ declare saved jsonb; stamp timestamptz; begin
 select updated_at into stamp from public.calendar_entries where id='a5555555-5555-4555-8555-555555555555';
 saved=public.save_calendar_activity_with_version('{"id":"a5555555-5555-4555-8555-555555555555","title":"Photo memory"}',stamp);
 if saved->>'id'<>'a5555555-5555-4555-8555-555555555555' or (saved->>'updated_at')::timestamptz<>(select updated_at from public.calendar_entries where id='a5555555-5555-4555-8555-555555555555') then raise exception 'Photo retry did not receive exact saved version'; end if;
 update public.calendar_entries set notes='Newer edit from another tab' where id='a5555555-5555-4555-8555-555555555555';
 begin
 perform public.save_calendar_activity_with_version('{"id":"a5555555-5555-4555-8555-555555555555","notes":"Stale photo retry"}',(saved->>'updated_at')::timestamptz);
 raise exception 'Photo retry overwrote newer activity'; exception when serialization_failure then null; end;
end $$;
insert into public.activity_photos(id,user_id,entry_id,content_type,byte_size) values('a6666666-6666-4666-8666-666666666666','a3333333-3333-4333-8333-333333333333','a5555555-5555-4555-8555-555555555555','image/jpeg',100);
insert into storage.objects(bucket_id,name) select 'activity-photos',storage_path from public.activity_photos;
update public.activity_photos set state='ready',caption='Private movie memory';
do $$ begin if (select caption from public.activity_photos where id='a6666666-6666-4666-8666-666666666666')<>'Private movie memory' then raise exception 'Caption not saved'; end if; end $$;
do $$ begin
 if (select count(*) from storage.objects where bucket_id='activity-photos')<>1 then raise exception 'Owner cannot see photo storage'; end if;
 begin
  insert into storage.objects(bucket_id,name) values('activity-photos','a3333333-3333-4333-8333-333333333333/unreserved.jpg');
  raise exception 'Unreserved upload allowed'; exception when insufficient_privilege then null; end;
 begin
  update public.calendar_entries set media_type=null,provider=null,provider_id=null,media_title=null where id='a5555555-5555-4555-8555-555555555555';
  raise exception 'Unlinked photo parent allowed'; exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub','a4444444-4444-4444-8444-444444444444',true);
do $$ declare affected integer; begin
 update public.activity_photos set caption='Forged'; get diagnostics affected=row_count; if affected<>0 then raise exception 'Other user edited caption'; end if;
 if exists(select 1 from public.activity_photos) or exists(select 1 from storage.objects where bucket_id='activity-photos') then raise exception 'Other user can read private photos'; end if;
 delete from public.activity_photos; get diagnostics affected=row_count; if affected<>0 then raise exception 'Other user deleted photo'; end if;
 delete from storage.objects where bucket_id='activity-photos'; get diagnostics affected=row_count; if affected<>0 then raise exception 'Other user deleted storage'; end if;
 begin
  insert into public.activity_photos(id,user_id,entry_id,content_type,byte_size) values(gen_random_uuid(),'a4444444-4444-4444-8444-444444444444','a5555555-5555-4555-8555-555555555555','image/jpeg',100);
  raise exception 'Other user attached photo'; exception when check_violation then null; end;
end $$;
set local role anon;
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='activity-photos') then raise exception 'Legacy policy exposed photos anonymously'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','a3333333-3333-4333-8333-333333333333',true);
do $$ begin
 for i in 1..5 loop
 insert into public.activity_photos(id,user_id,entry_id,content_type,byte_size) values(gen_random_uuid(),'a3333333-3333-4333-8333-333333333333','a5555555-5555-4555-8555-555555555555','image/jpeg',100);
 end loop;
 begin
 insert into public.activity_photos(id,user_id,entry_id,content_type,byte_size) values(gen_random_uuid(),'a3333333-3333-4333-8333-333333333333','a5555555-5555-4555-8555-555555555555','image/jpeg',100);
 raise exception 'More than six photos allowed'; exception when check_violation then null; end;
end $$;
delete from public.calendar_entries where id='a5555555-5555-4555-8555-555555555555';
do $$ begin
 if exists(select 1 from public.activity_photos) then raise exception 'Activity deletion left photo metadata'; end if;
 if (select count(*) from public.activity_photo_cleanup)<>6 then raise exception 'Physical cleanup not durably queued'; end if;
end $$;
delete from storage.objects where bucket_id='activity-photos';
do $$ begin if exists(select 1 from storage.objects where bucket_id='activity-photos') then raise exception 'Owner cannot clean retired objects'; end if; end $$;
reset role;
rollback;
