-- Private activity photos. Apply after 001-008. Supabase Storage is required.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('activity-photos','activity-photos',false,8388608,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create table public.activity_photos (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 entry_id uuid not null,
 content_type text not null check(content_type in ('image/jpeg','image/png','image/webp')),
 byte_size integer not null check(byte_size between 1 and 8388608),
 state text not null default 'pending' check(state in ('pending','ready')),
 storage_path text generated always as (user_id::text||'/'||entry_id::text||'/'||id::text||case content_type when 'image/jpeg' then '.jpg' when 'image/png' then '.png' else '.webp' end) stored unique,
 created_at timestamptz not null default now(),
 foreign key(user_id,entry_id) references public.calendar_entries(user_id,id) on delete cascade
);
create index activity_photos_entry on public.activity_photos(user_id,entry_id,created_at,id);
create table public.activity_photo_cleanup (
 storage_path text primary key,
 user_id uuid not null,
 created_at timestamptz not null default now(),
 check(split_part(storage_path,'/',1)=user_id::text)
);
create function public.validate_activity_photo() returns trigger language plpgsql security invoker set search_path='' as $$
declare activity public.calendar_entries; begin
 select * into activity from public.calendar_entries where id=new.entry_id and user_id=new.user_id for update;
 if activity.id is null or activity.kind<>'actual' or activity.media_type is null then raise exception 'Photos require an owned media activity log' using errcode='23514'; end if;
 if tg_op='UPDATE' and (new.id,new.user_id,new.entry_id,new.content_type,new.byte_size,new.created_at) is distinct from (old.id,old.user_id,old.entry_id,old.content_type,old.byte_size,old.created_at) then raise exception 'Photo identity cannot change' using errcode='42501'; end if;
 if tg_op='INSERT' and (select count(*) from public.activity_photos where entry_id=new.entry_id and user_id=new.user_id)>=6 then raise exception 'Up to six photos per activity' using errcode='23514'; end if;
 return new;
end $$;
create trigger activity_photo_validate before insert or update on public.activity_photos for each row execute function public.validate_activity_photo();
create function public.queue_activity_photo_cleanup() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into public.activity_photo_cleanup(storage_path,user_id) values(old.storage_path,old.user_id) on conflict do nothing;
 return old;
end $$;
create trigger activity_photo_cleanup after delete on public.activity_photos for each row execute function public.queue_activity_photo_cleanup();
-- Relinking/removing media must not turn personal photos into unrelated attachments.
create function public.check_activity_photo_parent() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.media_type is null and exists(select 1 from public.activity_photos where entry_id=new.id and user_id=new.user_id) then raise exception 'Remove photos before unlinking this activity' using errcode='23514'; end if;
 return new;
end $$;
create trigger calendar_photo_parent before update on public.calendar_entries for each row execute function public.check_activity_photo_parent();
alter table public.activity_photos enable row level security;
alter table public.activity_photo_cleanup enable row level security;
revoke all on public.activity_photos,public.activity_photo_cleanup from public,anon,authenticated;
grant select,delete on public.activity_photos to authenticated;
grant insert(id,user_id,entry_id,content_type,byte_size),update(state) on public.activity_photos to authenticated;
grant select,delete,insert(storage_path,user_id) on public.activity_photo_cleanup to authenticated;
create policy "Photo owner reads" on public.activity_photos for select to authenticated using(user_id=(select auth.uid()));
create policy "Photo owner inserts" on public.activity_photos for insert to authenticated with check(user_id=(select auth.uid()));
create policy "Photo owner updates" on public.activity_photos for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "Photo owner deletes" on public.activity_photos for delete to authenticated using(user_id=(select auth.uid()));
create policy "Photo cleanup owner reads" on public.activity_photo_cleanup for select to authenticated using(user_id=(select auth.uid()));
create policy "Photo cleanup owner queues" on public.activity_photo_cleanup for insert to authenticated with check(user_id=(select auth.uid()));
create policy "Photo cleanup owner deletes" on public.activity_photo_cleanup for delete to authenticated using(user_id=(select auth.uid()));
create policy "Activity photo storage read" on storage.objects for select to authenticated using(bucket_id='activity-photos' and split_part(name,'/',1)=(select auth.uid())::text);
create policy "Activity photo storage upload" on storage.objects for insert to authenticated with check(bucket_id='activity-photos' and exists(select 1 from public.activity_photos p where p.storage_path=name and p.user_id=(select auth.uid()) and p.state='pending'));
create policy "Activity photo storage remove" on storage.objects for delete to authenticated using(bucket_id='activity-photos' and split_part(name,'/',1)=(select auth.uid())::text);
-- Restrictive boundaries also protect this bucket if an unrelated older
-- permissive Storage policy exists. Other buckets retain their own policies.
create policy "Activity photo owner boundary" on storage.objects as restrictive for all to authenticated
 using(bucket_id<>'activity-photos' or split_part(name,'/',1)=(select auth.uid())::text)
 with check(bucket_id<>'activity-photos' or (split_part(name,'/',1)=(select auth.uid())::text and exists(select 1 from public.activity_photos p where p.storage_path=name and p.user_id=(select auth.uid()) and p.state='pending')));
create policy "Activity photo anonymous boundary" on storage.objects as restrictive for all to anon
 using(bucket_id<>'activity-photos') with check(bucket_id<>'activity-photos');
-- Return the exact saved version in the same transaction. Photo retries retain
-- optimistic concurrency rather than overwriting a newer edit in another tab.
create function public.save_calendar_activity_with_version(p_entry jsonb,p_expected timestamptz default null,p_rating numeric default null,
 p_rating_changed boolean default false,p_update_current boolean default false,p_review text default null,p_spoilers boolean default false,p_episodes jsonb default null)
 returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved uuid; result jsonb; begin
 saved=public.save_calendar_activity(p_entry,p_expected,p_rating,p_rating_changed,p_update_current,p_review,p_spoilers,p_episodes);
 select jsonb_build_object('id',id,'updated_at',updated_at) into result from public.calendar_entries where id=saved and user_id=(select auth.uid());
 return result;
end $$;
revoke all on function public.save_calendar_activity_with_version(jsonb,timestamptz,numeric,boolean,boolean,text,boolean,jsonb) from public,anon;
grant execute on function public.save_calendar_activity_with_version(jsonb,timestamptz,numeric,boolean,boolean,text,boolean,jsonb) to authenticated;
revoke all on function public.validate_activity_photo(),public.queue_activity_photo_cleanup(),public.check_activity_photo_parent() from public,anon,authenticated;
commit;
