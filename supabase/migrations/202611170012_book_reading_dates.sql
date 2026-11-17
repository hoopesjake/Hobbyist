-- Apply after 011. Add reading dates without replacing saved books or sessions.
begin;
alter table public.book_tracking
 add column started_on date,
 add column finished_on date,
 add constraint book_reading_date_order check(started_on is null or finished_on is null or finished_on>=started_on);
grant insert(started_on,finished_on),update(started_on,finished_on) on public.book_tracking to authenticated;

-- Keep the existing view's columns in their original order, appending new ones.
-- Dates from actual sessions remain derived so edits/deletes cannot leave stale
-- dates or create duplicate Calendar records. Planned sessions do not count.
create or replace view public.book_library with (security_invoker=true) as
select b.user_id,b.ol_work_id,b.work_key,b.title,b.authors,b.cover_url,b.edition_id,
 b.status,b.status_explicit,b.total_pages,b.manual_current_page,b.rating,b.review,
 b.contains_spoilers,b.private_notes,b.created_at,b.updated_at,
 case when b.total_pages is not null and (b.status='finished' or b.finished_on is not null or s.finished_on is not null)
 then b.total_pages else greatest(b.manual_current_page,coalesce(s.last_page,0)) end as current_page,
 case when b.finished_on is not null or s.finished_on is not null then 'finished'
 when b.status='finished' then 'finished'
 when b.started_on is not null or s.started_on is not null then 'reading'
 when b.status_explicit then b.status
 when b.total_pages is not null and greatest(b.manual_current_page,coalesce(s.last_page,0))>=b.total_pages then 'finished'
 when b.status='reading' or b.manual_current_page>0 then 'reading' else 'want_to_read' end as effective_status,
 b.started_on,b.finished_on,
 case when b.started_on is null then s.started_on when s.started_on is null then b.started_on else least(b.started_on,s.started_on) end as effective_started_on,
 coalesce(b.finished_on,s.finished_on) as effective_finished_on
from public.book_tracking b left join lateral (
 select max(e.reading_end_page) as last_page,min(e.event_date) as started_on,
 min(e.event_date) filter(where b.total_pages is not null and e.reading_end_page>=b.total_pages) as finished_on
 from public.calendar_entries e where e.user_id=b.user_id and e.media_type='book'
 and e.provider_id=b.ol_work_id and e.kind='actual'
 and (e.reading_edition_id is not distinct from b.edition_id or e.reading_end_page is null)
) s on true;
revoke all on public.book_library from public,anon;
grant select on public.book_library to authenticated;
commit;
