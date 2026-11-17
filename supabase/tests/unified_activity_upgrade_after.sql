do $$ begin
 if (select count(*) from public.calendar_entries where user_id='f1111111-1111-4111-8111-111111111111')<>4 then raise exception 'Upgrade duplicated or lost dated sessions'; end if;
 if exists(select 1 from public.calendar_entries where user_id='f1111111-1111-4111-8111-111111111111' and session_rating is not null) then raise exception 'Upgrade invented dated ratings'; end if;
 if not exists(select 1 from public.movie_tracking where tmdb_id=990001 and on_watchlist and watched_on='2019-01-01' and rating=4 and review='Existing review') then raise exception 'Upgrade overwrote existing movie data'; end if;
 if not exists(select 1 from public.tv_tracking where tmdb_id=990004 and status='completed' and rating=5) then raise exception 'Upgrade changed completed show'; end if;
 if exists(select 1 from public.calendar_entries where provider_id=990003) then raise exception 'Upgrade invented undated viewing'; end if;
end $$;
delete from auth.users where id='f1111111-1111-4111-8111-111111111111';
