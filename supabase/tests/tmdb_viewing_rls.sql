-- Run as postgres in a disposable/local Supabase DB with both migrations applied.
-- Uses test-only auth identities. Everything is rolled back.
begin;
insert into auth.users (id, email, created_at) values
 ('33333333-3333-4333-8333-333333333333', 'tmdb-test-a@example.invalid', now()),
 ('44444444-4444-4444-8444-444444444444', 'tmdb-test-b@example.invalid', now());
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
insert into public.viewing_entries (user_id,media_type,tmdb_id,title,status) values ('33333333-3333-4333-8333-333333333333','movie',550,'Test movie','watchlist');
-- Mimics PostgREST upsert including the composite key.
insert into public.viewing_entries (user_id,media_type,tmdb_id,title,status,rating,watched_on)
values ('33333333-3333-4333-8333-333333333333','movie',550,'Test movie','completed',4.5,current_date)
on conflict (user_id,media_type,tmdb_id) do update set user_id=excluded.user_id,media_type=excluded.media_type,tmdb_id=excluded.tmdb_id,title=excluded.title,status=excluded.status,rating=excluded.rating,watched_on=excluded.watched_on;
insert into public.actor_follows (user_id,tmdb_person_id,name) values ('33333333-3333-4333-8333-333333333333',287,'Test actor');
do $$ begin
  if (select count(*) from public.viewing_entries where tmdb_id=550) <> 1 then raise exception 'Upsert duplicate or owner read failed'; end if;
  if (select rating from public.viewing_entries where tmdb_id=550) <> 4.5 then raise exception 'Rating persistence failed'; end if;
  if (select count(*) from public.viewing_events) <> 2 then raise exception 'Journal trigger did not record add/update'; end if;
  begin
    update public.viewing_entries set rating=3.7 where tmdb_id=550;
    raise exception 'Invalid star increment accepted';
  exception when check_violation then null; end;
  begin
    update public.viewing_entries set watched_on=current_date+1 where tmdb_id=550;
    raise exception 'Future watch date accepted';
  exception when check_violation then null; end;
  begin
    update public.viewing_entries set tmdb_id=551 where tmdb_id=550;
    raise exception 'Immutable title identity changed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.viewing_events;
    raise exception 'Journal deletion allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
do $$ declare affected integer; begin
  if exists(select 1 from public.viewing_entries) then raise exception 'Private library leaked'; end if;
  if exists(select 1 from public.actor_follows) then raise exception 'Private actor follows leaked'; end if;
  if exists(select 1 from public.viewing_events) then raise exception 'Private journal leaked'; end if;
  update public.viewing_entries set rating=1 where tmdb_id=550;
  get diagnostics affected=row_count;
  if affected <> 0 then raise exception 'Cross-user update allowed'; end if;
  delete from public.viewing_entries where tmdb_id=550;
  get diagnostics affected=row_count;
  if affected <> 0 then raise exception 'Cross-user delete allowed'; end if;
  delete from public.actor_follows where tmdb_person_id=287;
  get diagnostics affected=row_count;
  if affected <> 0 then raise exception 'Cross-user unfollow allowed'; end if;
  begin
    insert into public.viewing_entries (user_id,media_type,tmdb_id,title) values ('33333333-3333-4333-8333-333333333333','tv',1399,'Forged');
    raise exception 'Forged library ownership accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.actor_follows (user_id,tmdb_person_id,name) values ('33333333-3333-4333-8333-333333333333',500,'Forged');
    raise exception 'Forged follow ownership accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  begin
    perform * from public.viewing_entries;
    raise exception 'Anonymous library access allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.actor_follows;
    raise exception 'Anonymous follow access allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.viewing_events;
    raise exception 'Anonymous journal access allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
delete from public.actor_follows where tmdb_person_id=287;
delete from public.viewing_entries where tmdb_id=550;
do $$ begin
  if exists(select 1 from public.actor_follows where tmdb_person_id=287) then raise exception 'Owner unfollow failed'; end if;
  if exists(select 1 from public.viewing_entries where tmdb_id=550) then raise exception 'Owner remove failed'; end if;
  if (select count(*) from public.viewing_events) <> 2 then raise exception 'Removing a title unexpectedly removed journal history'; end if;
end $$;
reset role;
rollback;
