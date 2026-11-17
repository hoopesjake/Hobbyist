-- Apply after 009. Existing photos keep an empty optional caption.
begin;
alter table public.activity_photos add column caption text not null default '' check(char_length(caption)<=500);
grant insert(caption),update(caption) on public.activity_photos to authenticated;
commit;
