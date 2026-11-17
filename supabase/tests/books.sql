-- Books persistence, session synchronization, history and actual owner RLS.
begin;
insert into auth.users(id,email) values('b1111111-1111-4111-8111-111111111111','book-owner@example.test'),('b2222222-2222-4222-8222-222222222222','book-other@example.test');
create function pg_temp.reading_entry(i uuid,k text default 'actual') returns jsonb language sql as $$
 select jsonb_build_object('id',i,'kind',k,'status',case when k='plan' then 'planned' else null end,'title','Reading The Way of Kings','category','books','event_date',case when k='plan' then '2099-01-01' else '2020-01-01' end,'time_zone','UTC','media_type','book','provider','openlibrary','provider_id',15358691,'media_title','The Way of Kings','library_add',true,'approximate',false,'notes','Private reading memory','participants','')
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','b1111111-1111-4111-8111-111111111111',true);
-- PostgREST's merge-upsert updates identity columns too, even on the first
-- insert. Reproduce the rejected path without broadening column privileges.
do $$ begin
 begin
  insert into public.book_tracking(user_id,ol_work_id,title)
   values('b1111111-1111-4111-8111-111111111111',15358691,'The Way of Kings')
   on conflict(user_id,ol_work_id) do update set user_id=excluded.user_id,ol_work_id=excluded.ol_work_id,title=excluded.title;
  raise exception 'Identity-column upsert unexpectedly allowed';
 exception when insufficient_privilege then null; end;
end $$;
insert into public.book_tracking(user_id,ol_work_id,title,authors,status,total_pages,edition_id,rating,review,private_notes)
 values('b1111111-1111-4111-8111-111111111111',15358691,'The Way of Kings',array['Brandon Sanderson'],'want_to_read',1000,'OL61245450M',4.5,'Book review','Private library notes');
select public.save_reading_activity(pg_temp.reading_entry('b3333333-3333-4333-8333-333333333333','plan'));
do $$ begin
 if not exists(select 1 from public.book_library where ol_work_id=15358691 and effective_status='want_to_read' and current_page=0 and rating=4.5) then raise exception 'Planning changed reading progress/rating'; end if;
end $$;
select public.save_reading_activity(pg_temp.reading_entry('b4444444-4444-4444-8444-444444444444')||'{"plan_id":"b3333333-3333-4333-8333-333333333333","duration_minutes":60,"reading_start_page":1,"reading_end_page":50}',null,4,true,false);
do $$ declare stamp timestamptz; begin
 if not exists(select 1 from public.book_library where ol_work_id=15358691 and effective_status='reading' and current_page=50 and rating=4.5 and review='Book review' and private_notes='Private library notes') then raise exception 'Reading persistence or rating preservation failed'; end if;
 if not exists(select 1 from public.calendar_entries where id='b4444444-4444-4444-8444-444444444444' and pages_read=50 and reading_edition_id='OL61245450M' and session_rating=4 and notes='Private reading memory') then raise exception 'Reading log fields failed'; end if;
 select updated_at into stamp from public.calendar_entries where id='b4444444-4444-4444-8444-444444444444';
 perform public.save_reading_activity(pg_temp.reading_entry('b4444444-4444-4444-8444-444444444444')||'{"plan_id":"b3333333-3333-4333-8333-333333333333","reading_start_page":1,"reading_end_page":75}',stamp);
 if (select current_page from public.book_library where ol_work_id=15358691)<>75 then raise exception 'Edited pages double counted'; end if;
 begin
 perform public.save_reading_activity(pg_temp.reading_entry('b5555555-5555-4555-8555-555555555555')||'{"reading_start_page":76,"reading_end_page":1001}',null,1,true,true);
 raise exception 'Beyond-book page count accepted'; exception when check_violation then null; end;
 if exists(select 1 from public.calendar_entries where id='b5555555-5555-4555-8555-555555555555') or (select rating from public.book_tracking where ol_work_id=15358691)<>4.5 then raise exception 'Invalid reading log partially saved'; end if;
end $$;
select public.save_reading_activity(pg_temp.reading_entry('b5555555-5555-4555-8555-555555555555')||'{"reading_start_page":76,"reading_end_page":100}',null,5,true,true,'A separate review',false);
do $$ begin
 if (select current_page from public.book_library where ol_work_id=15358691)<>100 or (select rating from public.book_tracking where ol_work_id=15358691)<>5 then raise exception 'Second reading session not synchronized'; end if;
 if (select session_rating from public.calendar_entries where id='b4444444-4444-4444-8444-444444444444')<>4 then raise exception 'Earlier reading rating rewritten'; end if;
 begin
 perform public.save_reading_activity(pg_temp.reading_entry('b5555555-5555-4555-8555-555555555555'));
 raise exception 'Duplicate reading session accepted'; exception when unique_violation then null; end;
end $$;
delete from public.calendar_entries where id='b5555555-5555-4555-8555-555555555555';
update public.book_tracking set manual_current_page=30 where ol_work_id=15358691;
delete from public.calendar_entries where id='b4444444-4444-4444-8444-444444444444';
do $$ begin
 if (select current_page from public.book_library where ol_work_id=15358691)<>30 then raise exception 'Deleting sessions erased manual progress'; end if;
end $$;
-- Explicit status changes remain usable despite previous history/progress.
update public.book_tracking set status='finished',status_explicit=true where ol_work_id=15358691;
do $$ begin if (select effective_status from public.book_library where ol_work_id=15358691)<>'finished' then raise exception 'Finished status not persisted'; end if; end $$;
update public.book_tracking set status='want_to_read',status_explicit=true where ol_work_id=15358691;
do $$ begin if (select effective_status from public.book_library where ol_work_id=15358691)<>'want_to_read' then raise exception 'Want to Read status not persisted'; end if; end $$;
-- Choosing a new edition never applies old edition page positions to it.
select public.save_reading_activity(pg_temp.reading_entry('b6666666-6666-4666-8666-666666666666')||'{"reading_start_page":31,"reading_end_page":150}');
update public.book_tracking set edition_id='OL1M',total_pages=200,manual_current_page=0 where ol_work_id=15358691;
do $$ begin
 if (select current_page from public.book_library where ol_work_id=15358691)<>0 then raise exception 'Edition page positions mixed'; end if;
end $$;
-- Calendar-created catalog items enter the same personal library atomically.
select public.save_reading_activity((pg_temp.reading_entry('b7777777-7777-4777-8777-777777777777','plan')||'{"provider_id":42,"media_title":"New Book"}'),null,null,false,false,null,false,null,'{"title":"New Book","authors":["A real author"]}');
do $$ begin if not exists(select 1 from public.book_tracking where ol_work_id=42 and title='New Book' and authors=array['A real author']) then raise exception 'Calendar-to-library addition missing'; end if; end $$;
-- Manual dates and Calendar actuals feed the same derived lifecycle.
update public.book_tracking set total_pages=100,manual_current_page=5,started_on='2019-12-01',finished_on='2020-01-01' where ol_work_id=42;
do $$ begin
 if not exists(select 1 from public.book_library where ol_work_id=42 and effective_status='finished' and current_page=100 and effective_started_on='2019-12-01' and effective_finished_on='2020-01-01') then raise exception 'Manual finish did not complete book'; end if;
 begin
  update public.book_tracking set finished_on='2019-11-01' where ol_work_id=42;
  raise exception 'Reversed reading dates accepted'; exception when check_violation then null; end;
end $$;
update public.book_tracking set finished_on=null where ol_work_id=42;
do $$ begin if (select effective_status from public.book_library where ol_work_id=42)<>'reading' then raise exception 'Started-only book not reading'; end if; end $$;
update public.book_tracking set started_on=null,status='finished',status_explicit=true where ol_work_id=42;
do $$ begin if (select current_page from public.book_library where ol_work_id=42)<>100 then raise exception 'Finished status did not fill pages'; end if; end $$;
update public.book_tracking set status='want_to_read',status_explicit=false where ol_work_id=42;
select public.save_reading_activity(pg_temp.reading_entry('b8888888-8888-4888-8888-888888888888')||'{"provider_id":42,"media_title":"New Book","reading_start_page":1,"reading_end_page":100}');
do $$ begin
 if not exists(select 1 from public.book_library where ol_work_id=42 and effective_status='finished' and current_page=100 and effective_started_on='2020-01-01' and effective_finished_on='2020-01-01') then raise exception 'Calendar reading dates not synchronized'; end if;
end $$;
update public.calendar_entries set reading_end_page=50 where id='b8888888-8888-4888-8888-888888888888';
do $$ begin
 if not exists(select 1 from public.book_library where ol_work_id=42 and effective_status='reading' and current_page=50 and effective_finished_on is null) then raise exception 'Editing completion left stale finish'; end if;
end $$;
delete from public.calendar_entries where id='b8888888-8888-4888-8888-888888888888';
do $$ begin
 if not exists(select 1 from public.book_library where ol_work_id=42 and current_page=5 and effective_started_on is null and effective_finished_on is null) then raise exception 'Deleting session left stale dates'; end if;
end $$;
select set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
do $$ declare affected integer; begin
 if exists(select 1 from public.book_library) or exists(select 1 from public.book_tracking) or exists(select 1 from public.calendar_entries) then raise exception 'Private book data leaked'; end if;
 update public.book_tracking set private_notes='Forged';get diagnostics affected=row_count;if affected<>0 then raise exception 'Other owner updated book'; end if;
 begin
 perform public.save_reading_activity(pg_temp.reading_entry('b6666666-6666-4666-8666-666666666666'),'2020-01-01');
 raise exception 'Other owner changed reading log'; exception when serialization_failure then null; end;
end $$;
reset role;
rollback;
