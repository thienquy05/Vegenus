-- Guest and public read functions and table rules (T1.3; design 1 §5, §8; design 3 §3, §3.12, §9).
-- E3-E6, E12-E14, E28, E36, Q82. Placeholder data only.
begin;
select plan(40);

-- Pages: A token-only, B published, C private, D published but its wording was never published.
insert into public.pages (id, theme, default_lang, visibility, timezone, vanity_name, copy_published_at) values
  ('00000000-0000-0000-0000-00000000000a', 'a_dreamy', 'en', 'token_only', 'Asia/Ho_Chi_Minh', 'page-a', now()),
  ('00000000-0000-0000-0000-00000000000b', 'b_cosmic', 'vi', 'published', 'Asia/Ho_Chi_Minh', 'page-b', now()),
  ('00000000-0000-0000-0000-00000000000c', 'c_cozy', 'en', 'private', 'UTC', 'page-c', now()),
  ('00000000-0000-0000-0000-00000000000d', 'd_elegant', 'en', 'published', 'UTC', 'page-d', null);

insert into public.guest_tokens (page_id, version, token_hash, active, request_id) values
  ('00000000-0000-0000-0000-00000000000a', 1, sha256('token-a-old'::bytea), false, gen_random_uuid()),
  ('00000000-0000-0000-0000-00000000000a', 2, sha256('token-a'::bytea), true, gen_random_uuid()),
  ('00000000-0000-0000-0000-00000000000b', 1, sha256('token-b'::bytea), true, gen_random_uuid()),
  ('00000000-0000-0000-0000-00000000000c', 1, sha256('token-c'::bytea), true, gen_random_uuid()),
  ('00000000-0000-0000-0000-00000000000d', 1, sha256('token-d'::bytea), true, gen_random_uuid());

update public.page_sections set enabled = true where section in ('memories', 'guestbook');

insert into public.items (id, page_id, kind, status, lang, title, event_date, date_precision, sort_order) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'memory', 'published', 'en', 'A memory one', '2020-01-01', 'day', 1),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', 'memory', 'published', 'en', 'A memory two', '2020-01-01', 'day', 2),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-00000000000a', 'memory', 'draft', 'en', 'A draft', '2020-01-01', 'day', 3),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-00000000000a', 'milestone', 'published', 'en', 'A milestone', '2020-01-01', 'day', 4),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', 'memory', 'published', 'vi', 'B memory', '2020-01-01', 'day', 1),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000c', 'memory', 'published', 'en', 'C memory', '2020-01-01', 'day', 1),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000d', 'memory', 'published', 'en', 'D memory', '2020-01-01', 'day', 1);

insert into public.guestbook_entries (page_id, display_name, body, lang, status, submission_id, author_kind, token_version) values
  ('00000000-0000-0000-0000-00000000000a', '[GUEST]', 'A approved', 'en', 'approved', gen_random_uuid(), 'token', 2),
  ('00000000-0000-0000-0000-00000000000a', '[GUEST]', 'A pending', 'en', 'pending', gen_random_uuid(), 'token', 2),
  ('00000000-0000-0000-0000-00000000000a', '[GUEST]', 'A rejected', 'en', 'rejected', gen_random_uuid(), 'token', 1),
  ('00000000-0000-0000-0000-00000000000b', '[GUEST]', 'B approved', 'vi', 'approved', gen_random_uuid(), 'visitor', null),
  ('00000000-0000-0000-0000-00000000000d', '[GUEST]', 'D approved', 'en', 'approved', gen_random_uuid(), 'visitor', null);

-- Table rules (design 3 §3.1, §3.3; E12-E14, PRD §4.1).
select lives_ok($$insert into public.items (page_id, kind, status, lang, title) values ('00000000-0000-0000-0000-00000000000a', 'home', 'draft', 'en', 'Home')$$,
  'a home item without start_date is accepted (E53)');
select throws_ok($$insert into public.items (page_id, kind, status, lang, title) values ('00000000-0000-0000-0000-00000000000a', 'home', 'draft', 'en', 'Home two')$$,
  '23505', null, 'a second home item on one page is rejected');
select throws_ok($$insert into public.items (page_id, kind, lang, title, event_date, date_precision) values ('00000000-0000-0000-0000-00000000000a', 'anniversary', 'en', 'Anniversary', '2020-01-01', 'month')$$,
  '23514', null, 'an anniversary without day precision is rejected');
select throws_ok($$insert into public.items (page_id, kind, lang, title, event_date) values ('00000000-0000-0000-0000-00000000000a', 'anniversary', 'en', 'Anniversary', '2020-01-01')$$,
  '23514', null, 'an anniversary with no date precision is rejected');
select throws_ok($$insert into public.items (page_id, kind, lang, title, lang_alt, title_alt, event_date, date_precision) values ('00000000-0000-0000-0000-00000000000a', 'memory', 'en', 'Memory', 'en', 'Alt', '2020-01-01', 'day')$$,
  '23514', null, 'lang_alt equal to lang is rejected (E13)');
select throws_ok($$insert into public.items (page_id, kind, lang, title, title_alt, event_date, date_precision) values ('00000000-0000-0000-0000-00000000000a', 'memory', 'en', 'Memory', 'Alt', '2020-01-01', 'day')$$,
  '23514', null, 'alt text without lang_alt is rejected (E13)');
select throws_ok(format($$insert into public.items (page_id, kind, lang, title, event_date, date_precision) values ('00000000-0000-0000-0000-00000000000a', 'memory', 'vi', %L, '2020-01-01', 'day')$$, normalize('Kỷ niệm', nfd)),
  '23514', null, 'a non-NFC title is rejected (E12)');
select lives_ok(format($$insert into public.items (page_id, kind, lang, title, event_date, date_precision) values ('00000000-0000-0000-0000-00000000000a', 'memory', 'vi', %L, '2020-01-01', 'day')$$, normalize('Kỷ niệm', nfc)),
  'the same title in NFC is accepted (E12)');
select throws_ok(format($$insert into public.items (page_id, kind, lang, title, event_date, date_precision) values ('00000000-0000-0000-0000-00000000000a', 'memory', 'en', %L, '2020-01-01', 'day')$$, repeat('x', 121)),
  '23514', null, 'a title over 120 characters is rejected');
insert into public.pages (id, theme, default_lang, timezone) values ('00000000-0000-0000-0000-00000000000e', 'a_dreamy', 'en', 'UTC');
select results_eq($$select section::text, enabled from public.page_sections where page_id = '00000000-0000-0000-0000-00000000000e' order by sort_order$$,
  $$values ('home', false), ('memories', false), ('together', false), ('guestbook', false), ('zodiac', false)$$,
  'a new page has all five sections present and disabled (PRD §4.1)');

set local role anon;

-- E36: the anon role reads no table directly.
select throws_ok('select 1 from public.pages', '42501', null, 'anon cannot select pages');
select throws_ok('select 1 from public.page_sections', '42501', null, 'anon cannot select page_sections');
select throws_ok('select 1 from public.memberships', '42501', null, 'anon cannot select memberships');
select throws_ok('select 1 from public.guest_tokens', '42501', null, 'anon cannot select guest_tokens');
select throws_ok('select 1 from public.items', '42501', null, 'anon cannot select items');
select throws_ok('select 1 from public.guestbook_entries', '42501', null, 'anon cannot select guestbook_entries');

-- guest_open: one generic empty result for every failure (E3, E4, Q82).
select is(public.guest_open('token-unknown'), null, 'unknown token: empty result');
select is(public.guest_open('token-a-old'), null, 'rotated token: empty result (E3)');
select is(public.guest_open('token-c'), null, 'private page: empty result (E4)');
select is(public.guest_open('token-d'), null, 'wording never published: empty result (Q82)');
select is(public.guest_open('token-a'), '{"theme": "a_dreamy", "default_lang": "en", "sections": ["memories", "guestbook"]}'::jsonb,
  'valid token: page summary with enabled sections only (E5)');

-- guest_list: published items of an enabled section of the token's page only (E5, E6, E28).
select results_eq($$select title from public.guest_list('token-a', 'memories')$$, array['A memory one', 'A memory two'],
  'published items of the token''s page, no draft, no other page');
select is_empty($$select * from public.guest_list('token-a', 'together')$$, 'disabled section returns nothing (E5)');
select is_empty($$select * from public.guest_list('token-a-old', 'memories')$$, 'rotated token returns nothing (E3)');
select is_empty($$select * from public.guest_list('token-c', 'memories')$$, 'private page returns nothing (E4)');
select results_eq($$select title from public.guest_list('token-a', 'memories', 1, '00000000-0000-0000-0000-0000000000a1')$$, array['A memory two'],
  'keyset cursor continues after the given row');
select is((select array_agg(k order by k) from public.guest_list('token-a', 'memories') g, jsonb_object_keys(to_jsonb(g)) k where g.title = 'A memory one'),
  array['body', 'body_alt', 'date_precision', 'event_date', 'id', 'kind', 'lang', 'lang_alt', 'recurs_yearly', 'sort_order', 'start_date', 'title', 'title_alt', 'zodiac_key', 'zodiac_system'],
  'items carry an explicit column list, no internal column (E28)');

-- guest_guestbook_list: approved entries only (E28).
select results_eq($$select body from public.guest_guestbook_list('token-a')$$, array['A approved'], 'approved entries only');
select is((select array_agg(k order by k) from public.guest_guestbook_list('token-a') g, jsonb_object_keys(to_jsonb(g)) k),
  array['approved_at', 'body', 'created_at', 'display_name', 'id', 'lang'],
  'entries carry an explicit column list, no internal column (E28)');

-- public_*: Published pages with published wording only (E31, E36, E47).
select is(public.public_open('page-b'), '{"theme": "b_cosmic", "default_lang": "vi", "sections": ["memories", "guestbook"]}'::jsonb,
  'published page: page summary');
select is(public.public_open('page-a'), null, 'token-only page: empty result (E47)');
select is(public.public_open('page-c'), null, 'private page: empty result');
select is(public.public_open('page-d'), null, 'wording never published: empty result (Q82)');
select is(public.public_open('page-unknown'), null, 'unknown selector: empty result');
select results_eq($$select title from public.public_list('page-b', 'memories')$$, array['B memory'], 'published page lists its published items');
select is_empty($$select * from public.public_list('page-a', 'memories')$$, 'token-only page lists nothing');
select results_eq($$select body from public.public_guestbook_list('page-b')$$, array['B approved'], 'published page lists approved entries');
select is_empty($$select * from public.public_guestbook_list('page-a')$$, 'token-only page lists no entries');

-- State changes take effect on the next call (design 1 §6).
reset role;
update public.page_sections set enabled = false where page_id = '00000000-0000-0000-0000-00000000000a' and section = 'guestbook';
update public.pages set visibility = 'private' where id = '00000000-0000-0000-0000-00000000000b';
set local role anon;
select is_empty($$select * from public.guest_guestbook_list('token-a')$$, 'guestbook disabled: no entries (E5)');
select is_empty($$select * from public.guest_list('token-b', 'memories')$$, 'page set private: next call returns nothing (E4)');

select * from finish();
rollback;
