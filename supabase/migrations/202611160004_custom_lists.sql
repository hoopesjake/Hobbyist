begin;
create table public.media_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  visibility text not null default 'private' check (visibility in ('private','public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.media_list_items (
  list_id uuid not null references public.media_lists(id) on delete cascade,
  media_type text not null check (media_type in ('movie','tv')),
  tmdb_id integer not null check (tmdb_id > 0),
  created_at timestamptz not null default now(),
  primary key (list_id,media_type,tmdb_id)
);
create index media_lists_owner on public.media_lists(user_id,created_at desc,id);
create index media_list_items_recent on public.media_list_items(list_id,created_at desc,media_type,tmdb_id);
alter table public.media_lists enable row level security;
alter table public.media_list_items enable row level security;
revoke all on public.media_lists,public.media_list_items from public,anon,authenticated;
grant select(id,name,visibility,created_at,updated_at) on public.media_lists to anon;
grant select,delete on public.media_lists to authenticated;
grant insert(user_id,name,visibility),update(name,visibility) on public.media_lists to authenticated;
grant select on public.media_list_items to anon,authenticated;
grant insert(list_id,media_type,tmdb_id),delete on public.media_list_items to authenticated;
create policy "Visible lists" on public.media_lists for select to anon,authenticated
  using (visibility='public' or user_id=(select auth.uid()));
create policy "Create own lists" on public.media_lists for insert to authenticated
  with check (user_id=(select auth.uid()));
create policy "Edit own lists" on public.media_lists for update to authenticated
  using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy "Delete own lists" on public.media_lists for delete to authenticated
  using (user_id=(select auth.uid()));
create policy "Visible list items" on public.media_list_items for select to anon,authenticated
  using (exists(select 1 from public.media_lists where id=list_id));
create policy "Add to own lists" on public.media_list_items for insert to authenticated
  with check (exists(select 1 from public.media_lists where id=list_id and user_id=(select auth.uid())));
create policy "Remove from own lists" on public.media_list_items for delete to authenticated
  using (exists(select 1 from public.media_lists where id=list_id and user_id=(select auth.uid())));
create function public.touch_media_list() returns trigger language plpgsql set search_path='' as $$
begin
  new.updated_at=now();
  return new;
end;
$$;
revoke all on function public.touch_media_list() from public,anon,authenticated;
create trigger media_list_updated before update on public.media_lists for each row execute function public.touch_media_list();
commit;
