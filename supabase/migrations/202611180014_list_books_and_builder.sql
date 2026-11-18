-- Additive. Apply after 001-013. No existing lists, items, or positions are rewritten.
-- Adds Books as a fourth list media type, and two atomic RPCs so the rebuilt List
-- Builder can create/edit a list and all its items in a single transaction instead of
-- an empty list appearing immediately followed by one-row-at-a-time inserts.
begin;
alter table public.media_list_items add column ol_id integer check(ol_id>0);
alter table public.media_list_items drop constraint media_list_items_media_type_check;
alter table public.media_list_items add constraint media_list_items_media_type_check check(media_type in ('movie','tv','game','book'));
alter table public.media_list_items drop constraint media_list_identity;
alter table public.media_list_items add constraint media_list_identity check(
  (media_type='game' and igdb_id is not null and tmdb_id is null and ol_id is null) or
  (media_type='book' and ol_id is not null and tmdb_id is null and igdb_id is null) or
  (media_type in ('movie','tv') and tmdb_id is not null and igdb_id is null and ol_id is null)
);
create unique index media_list_ol_identity on public.media_list_items(list_id,ol_id) where ol_id is not null;
grant insert(ol_id) on public.media_list_items to authenticated;

-- Same reordering semantics as before, extended to recognize books.
create or replace function public.move_media_list_item(p_list uuid,p_type text,p_id integer,p_direction integer) returns void language plpgsql security definer set search_path='' as $$
declare current_position bigint; other_position bigint; other_type text; other_id integer;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.media_lists where id=p_list and user_id=(select auth.uid())) then raise exception 'List owner required' using errcode='42501'; end if;
 if p_direction is null or p_direction not in (-1,1) or p_type is null or p_type not in ('movie','tv','game','book') or p_id is null or p_id<=0 then raise exception 'Invalid list movement' using errcode='22023'; end if;
 perform 1 from public.media_lists where id=p_list for update;
 select position into current_position from public.media_list_items where list_id=p_list and media_type=p_type and coalesce(igdb_id,ol_id,tmdb_id)=p_id;
 if current_position is null then return; end if;
 select position,media_type,coalesce(igdb_id,ol_id,tmdb_id) into other_position,other_type,other_id from public.media_list_items
 where list_id=p_list and (case when p_direction=-1 then position<current_position else position>current_position end)
 order by (case when p_direction=-1 then -position else position end) asc limit 1;
 if other_position is null then return; end if;
 update public.media_list_items set position=other_position where list_id=p_list and media_type=p_type and coalesce(igdb_id,ol_id,tmdb_id)=p_id;
 update public.media_list_items set position=current_position where list_id=p_list and media_type=other_type and coalesce(igdb_id,ol_id,tmdb_id)=other_id;
end;
$$;

-- Builder creates the list and every item in one transaction: no empty list appears if the
-- browser drops the connection partway through, and a duplicate submit cannot create two lists
-- (the caller only gets an id back once everything committed).
create function public.create_media_list_with_items(p_name text,p_description text,p_visibility text,p_items jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_list_id uuid; v_item jsonb;
begin
 if (select auth.uid()) is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if jsonb_typeof(coalesce(p_items,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_items,'[]'::jsonb))>500 then raise exception 'Invalid list items' using errcode='22023'; end if;
 insert into public.media_lists(user_id,name,description,visibility) values ((select auth.uid()),p_name,p_description,p_visibility) returning id into v_list_id;
 for v_item in select value from jsonb_array_elements(p_items) with ordinality as t(value,ord) order by ord loop
  insert into public.media_list_items(list_id,media_type,tmdb_id,igdb_id,ol_id) values (
   v_list_id, v_item->>'media_type',
   nullif(v_item->>'tmdb_id','')::integer, nullif(v_item->>'igdb_id','')::integer, nullif(v_item->>'ol_id','')::integer
  );
 end loop;
 return v_list_id;
end;
$$;
revoke all on function public.create_media_list_with_items(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_media_list_with_items(text,text,text,jsonb) to authenticated;

-- Editing reuses the same Builder: name/description/visibility and the full item set are
-- replaced together, so a reorder or an added item can never partially save.
create function public.update_media_list_with_items(p_list uuid,p_name text,p_description text,p_visibility text,p_items jsonb) returns void language plpgsql security definer set search_path='' as $$
declare v_item jsonb;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.media_lists where id=p_list and user_id=(select auth.uid())) then raise exception 'List owner required' using errcode='42501'; end if;
 if jsonb_typeof(coalesce(p_items,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_items,'[]'::jsonb))>500 then raise exception 'Invalid list items' using errcode='22023'; end if;
 perform 1 from public.media_lists where id=p_list for update;
 update public.media_lists set name=p_name,description=p_description,visibility=p_visibility where id=p_list;
 delete from public.media_list_items where list_id=p_list;
 for v_item in select value from jsonb_array_elements(p_items) with ordinality as t(value,ord) order by ord loop
  insert into public.media_list_items(list_id,media_type,tmdb_id,igdb_id,ol_id) values (
   p_list, v_item->>'media_type',
   nullif(v_item->>'tmdb_id','')::integer, nullif(v_item->>'igdb_id','')::integer, nullif(v_item->>'ol_id','')::integer
  );
 end loop;
end;
$$;
revoke all on function public.update_media_list_with_items(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.update_media_list_with_items(uuid,text,text,text,jsonb) to authenticated;
commit;
