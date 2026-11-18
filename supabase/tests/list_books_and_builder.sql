-- Run as postgres against a disposable Supabase database after migrations 001-014.
-- All fixtures and changes roll back.
begin;
insert into auth.users(id,email) values
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','builder-owner@example.invalid'),
 ('ffffffff-ffff-4fff-8fff-ffffffffffff','builder-visitor@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
do $$ declare v_list uuid; v_order text[]; begin
 -- Atomic create: list + mixed-media items (including a book) all land in one transaction.
 v_list := public.create_media_list_with_items('My Favorite Stories','Mixed media','public',
  '[{"media_type":"movie","tmdb_id":157336},{"media_type":"tv","tmdb_id":84958},{"media_type":"book","ol_id":1},{"media_type":"game","igdb_id":1942}]'::jsonb);
 if (select count(*) from public.media_list_items where list_id=v_list)<>4 then raise exception 'Not all items were created'; end if;
 select array_agg(media_type order by position) into v_order from public.media_list_items where list_id=v_list;
 if v_order<>array['movie','tv','book','game'] then raise exception 'Item order not preserved: %', v_order; end if;
 if not exists(select 1 from public.media_list_items where list_id=v_list and media_type='book' and ol_id=1) then raise exception 'Book item missing ol_id'; end if;
 -- Edit atomically replaces fields and the full item set.
 perform public.update_media_list_with_items(v_list,'Renamed','Still mixed','private',
  '[{"media_type":"book","ol_id":2},{"media_type":"movie","tmdb_id":157336}]'::jsonb);
 if (select count(*) from public.media_list_items where list_id=v_list)<>2 then raise exception 'Edit did not replace item set'; end if;
 if (select name from public.media_lists where id=v_list)<>'Renamed' then raise exception 'Edit did not rename list'; end if;
 if (select visibility from public.media_lists where id=v_list)<>'private' then raise exception 'Edit did not change visibility'; end if;
 -- move_media_list_item still recognizes the new book type.
 perform public.move_media_list_item(v_list,'book',2,1);
 select array_agg(media_type order by position) into v_order from public.media_list_items where list_id=v_list;
 if v_order<>array['movie','book'] then raise exception 'Book item did not reorder: %', v_order; end if;
 -- A bad item shape (both tmdb_id and ol_id null) is rejected by the table check, not silently dropped.
 begin perform public.create_media_list_with_items('Bad','','private','[{"media_type":"book"}]'::jsonb); raise exception 'Invalid book item accepted'; exception when check_violation then null; end;
 delete from public.media_lists where id=v_list;
end $$;
-- Ownership: a non-owner cannot edit or reorder someone else's list via the new RPCs.
do $$ declare v_list uuid; begin
 v_list := public.create_media_list_with_items('Owner only','','private','[]'::jsonb);
 select set_config('request.jwt.claim.sub','ffffffff-ffff-4fff-8fff-ffffffffffff',true);
 begin perform public.update_media_list_with_items(v_list,'Hijacked','','public','[]'::jsonb); raise exception 'Non-owner edited list via RPC'; exception when insufficient_privilege then null; end;
 begin perform public.move_media_list_item(v_list,'movie',1,1); raise exception 'Non-owner reordered list via RPC'; exception when insufficient_privilege then null; end;
 select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
 delete from public.media_lists where id=v_list;
end $$;
reset role;
rollback;
