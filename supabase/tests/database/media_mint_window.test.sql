-- Mint deadline (T2.3b, Codex review): upload URLs last 2 hours (Q135) and can be minted only while the storage insert
-- policy allows it, so the policy allows it for 5 minutes after Begin only. Every token then expires before write_until
-- (Begin + 2 h 5 min), and so before the deletion fence (write_until + 15 min). Placeholder data only.
begin;
select plan(4);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'owner@example.test');
insert into public.pages (id, theme, default_lang, timezone) values ('00000000-0000-0000-0000-0000000000a1', 'a_dreamy', 'en', 'UTC');
insert into public.memberships (page_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1', 'owner');
insert into public.items (id, page_id, kind, lang, title, event_date, date_precision) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'memory', 'en', 'Memory', '2024-05-01', 'day');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
create temp table up as select public.owner_upload_begin('00000000-0000-0000-0000-0000000000b1', 'photo', '{thumb,display}') as v;
grant select on up to authenticated;
create temp table thumb as select f ->> 'bucket' as bucket, f ->> 'path' as path from up, jsonb_array_elements(v -> 'files') f where f ->> 'variant' = 'thumb';
grant select on thumb to authenticated;

select ok(public.owner_upload_admitted((select bucket from thumb), (select path from thumb)), 'right after Begin the path may be minted');
update public.upload_reservations set created_at = now() - interval '4 minutes 59 seconds';
select ok(public.owner_upload_admitted((select bucket from thumb), (select path from thumb)), 'still inside the 5 minutes');
update public.upload_reservations set created_at = now() - interval '5 minutes 1 second';
select ok(not public.owner_upload_admitted((select bucket from thumb), (select path from thumb)),
  'after 5 minutes it may not, although write_until is still 2 hours away');
set local role authenticated;
select throws_ok($$ insert into storage.objects (bucket_id, name) select bucket, path from thumb $$, '42501', null,
  'so the storage insert policy refuses a late mint');
reset role;

select * from finish();
rollback;
