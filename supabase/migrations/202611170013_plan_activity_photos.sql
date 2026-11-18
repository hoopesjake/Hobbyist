-- Apply after 009-012. Photos may now be attached to planned activities, not just logged ones.
begin;
create or replace function public.validate_activity_photo() returns trigger language plpgsql security invoker set search_path='' as $$
declare activity public.calendar_entries; begin
 select * into activity from public.calendar_entries where id=new.entry_id and user_id=new.user_id for update;
 if activity.id is null or activity.media_type is null then raise exception 'Photos require an owned media activity' using errcode='23514'; end if;
 if tg_op='UPDATE' and (new.id,new.user_id,new.entry_id,new.content_type,new.byte_size,new.created_at) is distinct from (old.id,old.user_id,old.entry_id,old.content_type,old.byte_size,old.created_at) then raise exception 'Photo identity cannot change' using errcode='42501'; end if;
 if tg_op='INSERT' and (select count(*) from public.activity_photos where entry_id=new.entry_id and user_id=new.user_id)>=6 then raise exception 'Up to six photos per activity' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function public.validate_activity_photo() from public,anon,authenticated;
commit;
