-- Run in Supabase SQL Editor only if the Phase 2A migration already exists.
-- Restore missing profile/preferences rows for existing auth users.
-- Existing rows, auth accounts, passwords, and policies are preserved.
begin;
insert into public.profiles (id, username, created_at)
select id, 'h_' || substr(replace(id::text, '-', ''), 1, 28), created_at
from auth.users
where not exists (select 1 from public.profiles where profiles.id = auth.users.id)
on conflict (id) do nothing;
insert into public.user_preferences (user_id)
select id from auth.users
where not exists (select 1 from public.user_preferences where user_preferences.user_id = auth.users.id)
on conflict (user_id) do nothing;
commit;
