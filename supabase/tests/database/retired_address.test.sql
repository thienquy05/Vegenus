-- Retired page addresses (T3.1p follow-up, owner decision 2026-11-27, PRD §12): when a page is deleted, its current and
-- earlier addresses stay reserved forever, so an old link, a saved or printed address or a search result can never open
-- someone else's page. Only a SHA-256 fingerprint of each name is kept (the readable name goes with the page); a new
-- page asking for one gets the ordinary "taken" answer (23505). No API role reads the fingerprints. Placeholder data.
begin;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000f2', 'leaving-owner@example.test');
insert into public.pages (id, theme, default_lang, visibility, timezone, vanity_name, copy_published_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'a_dreamy', 'en', 'token_only', 'UTC', null, now()),
  ('00000000-0000-0000-0000-0000000000a2', 'b_cosmic', 'vi', 'published', 'UTC', 'old-name', now());
update public.pages set vanity_name = 'our-page' where id = '00000000-0000-0000-0000-0000000000a2';
insert into public.memberships (page_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', 'owner'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000f2', 'owner');

-- The page is deleted (the future owner deletion function deletes the page row; design 3 "Account and page deletion").
delete from public.pages where id = '00000000-0000-0000-0000-0000000000a2';
select is((select count(*)::int from public.pages where id = '00000000-0000-0000-0000-0000000000a2'), 0, 'the page is gone');
select is((select count(*)::int from public.page_vanity_names where name in ('old-name', 'our-page')), 0, 'its readable names went with it');
select is((select count(*)::int from public.retired_vanity_names
  where name_hash in (extensions.digest('old-name', 'sha256'), extensions.digest('our-page', 'sha256'))), 2,
  'a fingerprint of the current and the earlier address stays');
select is((select count(*)::int from information_schema.columns
  where table_schema = 'public' and table_name = 'retired_vanity_names' and data_type in ('text', 'character varying')), 0,
  'no readable name is stored');

select throws_ok($$update public.pages set vanity_name = 'our-page' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '23505', null, 'another page cannot take the deleted page''s current address');
select throws_ok($$update public.pages set vanity_name = 'old-name' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '23505', null, 'nor its earlier one');
update public.pages set vanity_name = 'fresh-name' where id = '00000000-0000-0000-0000-0000000000a1';
select is((select vanity_name from public.pages where id = '00000000-0000-0000-0000-0000000000a1'), 'fresh-name', 'an unused name is still free');

select ok(not has_table_privilege('anon', 'public.retired_vanity_names', 'select')
  and not has_table_privilege('authenticated', 'public.retired_vanity_names', 'select'), 'no API role reads the fingerprints');

select * from finish();
rollback;
