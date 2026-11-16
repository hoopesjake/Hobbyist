-- Run as postgres in a disposable/local Supabase database after the migration.
-- All fixtures are rolled back; any failed assertion aborts the transaction.
begin;
insert into auth.users (id, email, created_at) values
 ('11111111-1111-4111-8111-111111111111', 'phase2a-a@example.invalid', now()),
 ('22222222-2222-4222-8222-222222222222', 'phase2a-b@example.invalid', now());
update public.profiles set username = 'phase2a_test_a', visibility = 'public' where id = '11111111-1111-4111-8111-111111111111';
update public.profiles set username = 'phase2a_test_b', visibility = 'private' where id = '22222222-2222-4222-8222-222222222222';
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  if (select count(*) from public.profiles where username in ('phase2a_test_a','phase2a_test_b')) <> 1 then raise exception 'Anonymous profile visibility failed'; end if;
  begin
    perform * from public.user_preferences;
    raise exception 'Anonymous preferences must be forbidden';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
do $$ declare affected integer; begin
  if exists (select 1 from public.profiles where username = 'phase2a_test_b') then raise exception 'Private profile leaked'; end if;
  update public.profiles set bio = 'owner edit' where id = '11111111-1111-4111-8111-111111111111';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Owner edit failed'; end if;
  update public.profiles set bio = 'unauthorized' where id = '22222222-2222-4222-8222-222222222222';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-user edit succeeded'; end if;
  if exists (select 1 from public.user_preferences where user_id <> '11111111-1111-4111-8111-111111111111') then raise exception 'Preferences leaked'; end if;
  update public.user_preferences set settings = '{"theme":{"mode":"dark"}}' where user_id = '11111111-1111-4111-8111-111111111111';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Owner preferences update failed'; end if;
  begin
    update public.profiles set created_at = now() where id = '11111111-1111-4111-8111-111111111111';
    raise exception 'Creation date modification must be forbidden';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
do $$ declare affected integer; begin
  if not exists (select 1 from public.profiles where username = 'phase2a_test_b') then raise exception 'Owner cannot view private profile'; end if;
  update public.profiles set bio = 'unauthorized' where id = '11111111-1111-4111-8111-111111111111';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Another public profile was editable'; end if;
  begin
    update public.profiles set username = 'phase2a_test_a' where id = '22222222-2222-4222-8222-222222222222';
    raise exception 'Duplicate username was allowed';
  exception when unique_violation then null; end;
end $$;
reset role;
rollback;
