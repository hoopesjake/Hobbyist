-- Additive. Apply after 001-014. No existing profile, list, or tracking data is touched.
-- Up to 4 user-chosen favorites per category (movie/tv/game/book), shown near the top of
-- the profile. The user picks and orders these explicitly; nothing here is auto-derived
-- from ratings.
begin;
-- The public profile page needs the row id to look up favorites; it's an opaque UUID with
-- the same trust level as the already-public username, and RLS still gates which rows show.
grant select (id) on public.profiles to anon;
create table public.profile_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('movie','tv','game','book')),
  position smallint not null check (position between 1 and 4),
  tmdb_id integer check (tmdb_id > 0),
  igdb_id integer check (igdb_id > 0),
  ol_id integer check (ol_id > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, category, position),
  check (
    (category='game' and igdb_id is not null and tmdb_id is null and ol_id is null) or
    (category='book' and ol_id is not null and tmdb_id is null and igdb_id is null) or
    (category in ('movie','tv') and tmdb_id is not null and igdb_id is null and ol_id is null)
  )
);
create unique index profile_favorites_tmdb on public.profile_favorites(user_id,category,tmdb_id) where tmdb_id is not null;
create unique index profile_favorites_igdb on public.profile_favorites(user_id,igdb_id) where igdb_id is not null;
create unique index profile_favorites_ol on public.profile_favorites(user_id,ol_id) where ol_id is not null;
alter table public.profile_favorites enable row level security;
revoke all on public.profile_favorites from public,anon,authenticated;
grant select on public.profile_favorites to anon,authenticated;
grant insert(user_id,category,position,tmdb_id,igdb_id,ol_id),delete on public.profile_favorites to authenticated;
-- Visible exactly where the profile itself is visible: public profiles, or your own always.
create policy "Visible favorites" on public.profile_favorites for select to anon,authenticated
  using (exists(select 1 from public.profiles where id=user_id and (visibility='public' or (select auth.uid())=id)));
create policy "Owner adds favorites" on public.profile_favorites for insert to authenticated with check (user_id=(select auth.uid()));
create policy "Owner removes favorites" on public.profile_favorites for delete to authenticated using (user_id=(select auth.uid()));
-- One category's 4 slots are replaced atomically: no partial save, no stale extra slot
-- left over from a longer previous list, and positions 1..n always match the given order.
create function public.set_profile_favorites(p_category text,p_items jsonb) returns void language plpgsql security definer set search_path='' as $$
declare v_item jsonb; v_position smallint := 0;
begin
  if (select auth.uid()) is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if p_category not in ('movie','tv','game','book') then raise exception 'Invalid favorites category' using errcode='22023'; end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_items,'[]'::jsonb))>4 then raise exception 'Choose up to 4 favorites' using errcode='22023'; end if;
  delete from public.profile_favorites where user_id=(select auth.uid()) and category=p_category;
  for v_item in select value from jsonb_array_elements(p_items) with ordinality as t(value,ord) order by ord loop
    v_position := v_position + 1;
    insert into public.profile_favorites(user_id,category,position,tmdb_id,igdb_id,ol_id) values (
      (select auth.uid()), p_category, v_position,
      nullif(v_item->>'tmdb_id','')::integer, nullif(v_item->>'igdb_id','')::integer, nullif(v_item->>'ol_id','')::integer
    );
  end loop;
end;
$$;
revoke all on function public.set_profile_favorites(text,jsonb) from public,anon,authenticated;
grant execute on function public.set_profile_favorites(text,jsonb) to authenticated;
commit;
