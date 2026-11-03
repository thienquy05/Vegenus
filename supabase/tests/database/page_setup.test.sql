-- Page setup (T2.1a; owner UI O3; design 3 §3.1, §3.2, §5; PRD E55, E15, E6, E33, E12; Q111-Q117).
-- owner_save_page creates the caller's Private page on the first save and later names the version it read;
-- owner_page() returns the caller's page or null. Placeholder data only.
begin;
select plan(42);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000f2', 'coeditor@example.test'),
  ('00000000-0000-0000-0000-0000000000f6', 'new-owner@example.test'),
  ('00000000-0000-0000-0000-0000000000f7', 'other-new-owner@example.test');
-- A: f1's live page with f2 as the (reserved) co-editor. C: a page with no owner yet.
insert into public.pages (id, theme, default_lang, visibility, timezone, copy_published_at) values
  ('00000000-0000-0000-0000-00000000000a', 'a_dreamy', 'en', 'token_only', 'UTC', now()),
  ('00000000-0000-0000-0000-00000000000c', 'c_cozy', 'en', 'private', 'UTC', null);
insert into public.memberships (page_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f1', 'owner'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f2', 'co_editor');

create function pg_temp.act_as(id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.page_of(id uuid) returns uuid language sql as $$
  select m.page_id from public.memberships m where m.user_id = page_of.id and m.role = 'owner'
$$;

-- Who may call them.
select throws_ok($$ set local role anon; select public.owner_save_page(null, 'a_dreamy', 'en', null, null, 'UTC', '{}') $$,
  '42501', null, 'anon cannot call owner_save_page');
reset role;
select throws_ok($$ set local role anon; select public.owner_page() $$, '42501', null, 'anon cannot call owner_page');
reset role;
select ok(has_function_privilege('authenticated', 'public.owner_save_page(int, public.theme_id, public.lang, text, text, text, public.section_id[])', 'execute')
  and has_function_privilege('authenticated', 'public.owner_page()', 'execute'), 'authenticated can call owner_save_page and owner_page');
select ok(not has_function_privilege('vegenus_server', 'public.owner_save_page(int, public.theme_id, public.lang, text, text, text, public.section_id[])', 'execute')
  and not has_function_privilege('vegenus_server', 'public.owner_page()', 'execute'), 'vegenus_server cannot call them');

select throws_ok($$ select public.owner_save_page(null, 'a_dreamy', 'en', null, null, 'UTC', '{}') $$,
  '42501', null, 'no signed-in user is refused');
select is(public.owner_page(), null, 'no signed-in user has no page');

-- A new account has zero pages; its first save creates exactly one, Private, with nothing published (E55).
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f6');
select is(public.owner_page(), null, 'a new account has no page (E55)');
select is(public.owner_save_page(null, 'b_cosmic', 'vi', null, null, 'Asia/Ho_Chi_Minh', '{memories}'), 1,
  'the first save creates the page and returns its version');
select is(public.owner_page(), jsonb_build_object(
    'version', 1, 'theme', 'b_cosmic', 'default_lang', 'vi', 'label_a', null, 'label_b', null,
    'timezone', 'Asia/Ho_Chi_Minh', 'visibility', 'private', 'setup_completed', false,
    'sections', jsonb_build_array('home', 'memories')),
  'owner_page returns the saved choices, Home always on');
select ok((select p.visibility = 'private' and p.copy_published_at is null and p.setup_completed_at is null
  from public.pages p where p.id = pg_temp.page_of('00000000-0000-0000-0000-0000000000f6')),
  'the new page is Private, its wording unpublished and its setup unfinished');
select is((select count(*) from public.page_sections s where s.page_id = pg_temp.page_of('00000000-0000-0000-0000-0000000000f6')),
  5::bigint, 'the new page has all five sections');

-- A repeated first save finds the page and changes nothing; the concurrent case (unique index) was checked live (progress, T2.1a).
select is(public.owner_save_page(null, 'c_cozy', 'en', null, null, 'UTC', '{}'), null,
  'a second first save changes nothing');
select is((select count(*) from public.memberships m where m.user_id = '00000000-0000-0000-0000-0000000000f6'),
  1::bigint, 'the account still has one page');
select is((select p.theme::text from public.pages p where p.id = pg_temp.page_of('00000000-0000-0000-0000-0000000000f6')),
  'b_cosmic', 'the page kept its choices');
select throws_ok($$ insert into public.memberships (page_id, user_id, role) values
    ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000000f6', 'owner') $$,
  '23505', null, 'an account cannot own a second page');

-- Later saves name the version they read (design 3 §1.6, E15).
select is(public.owner_save_page(1, 'a_dreamy', 'en', 'Partner A', 'Partner B', 'UTC', '{together,guestbook}'), 2,
  'a save naming the current version updates the page and returns the next one');
select is(public.owner_page(), jsonb_build_object(
    'version', 2, 'theme', 'a_dreamy', 'default_lang', 'en', 'label_a', 'Partner A', 'label_b', 'Partner B',
    'timezone', 'UTC', 'visibility', 'private', 'setup_completed', false,
    'sections', jsonb_build_array('home', 'together', 'guestbook')),
  'owner_page returns the updated choices');
select is(public.owner_save_page(1, 'c_cozy', 'vi', 'Partner A', 'Partner B', 'UTC', '{memories}'), null,
  'a save naming an old version changes nothing (E15)');
select is((select p.theme::text from public.pages p where p.id = pg_temp.page_of('00000000-0000-0000-0000-0000000000f6')),
  'a_dreamy', 'the stale save left the page as it was');
select is((select array_agg(s.section::text order by s.sort_order) from public.page_sections s
    where s.page_id = pg_temp.page_of('00000000-0000-0000-0000-0000000000f6') and s.enabled),
  array['home', 'together', 'guestbook'], 'the stale save left the sections as they were');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000f7');
select is(public.owner_save_page(1, 'a_dreamy', 'en', null, null, 'UTC', '{}'), null,
  'a save naming a version for a page that does not exist changes nothing');
select is(public.owner_page(), null, 'and creates no page');

-- Bad input is refused and changes nothing; the route normalises names to NFC before they get here (E12).
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f6');
select throws_ok($$ select public.owner_save_page(2, 'a_dreamy', 'en', 'Partner A', 'Partner B', 'Mars/Olympus_Mons', '{}') $$,
  '22023', null, 'an unknown time zone is refused');
select throws_ok($$ select public.owner_save_page(2, 'a_dreamy', 'en', repeat('a', 41), 'Partner B', 'UTC', '{}') $$,
  '23514', null, 'a name over 40 characters is refused');
select throws_ok($$ select public.owner_save_page(2, 'a_dreamy', 'en', '', 'Partner B', 'UTC', '{}') $$,
  '23514', null, 'an empty name is refused (a name not set is null)');
select throws_ok($$ select public.owner_save_page(2, 'a_dreamy', 'en', normalize('Partner Á', nfd), 'Partner B', 'UTC', '{}') $$,
  '23514', null, 'a name not in NFC is refused');
select throws_ok($$ select public.owner_save_page(2, 'a_dreamy', 'en', E'Partner\nA', 'Partner B', 'UTC', '{}') $$,
  '22023', null, 'a line break in a name is refused');
select throws_ok($$ select public.owner_save_page(2, 'a_dreamy', 'en', 'Partner A', E'Partner \u202eB', 'UTC', '{}') $$,
  '22023', null, 'a bidirectional control in a name is refused');
select throws_ok($$ select public.owner_save_page(2, 'a_dreamy', 'en', E'Partner \u200eA', 'Partner B', 'UTC', '{}') $$,
  '22023', null, 'a left-to-right mark in a name is refused');
select throws_ok($$ select public.owner_save_page(2, 'a_dreamy', 'en', ' Partner A', 'Partner B', 'UTC', '{}') $$,
  '22023', null, 'a name with a space at either end is refused');
select throws_ok($$ select public.owner_save_page(2, 'a_dreamy', null, 'Partner A', 'Partner B', 'UTC', '{}') $$,
  '22023', null, 'a missing language is refused (a missing theme is allowed, Q128: theme_optional.test.sql)');
select is((public.owner_page() ->> 'version')::int, 2, 'the refused saves changed nothing');

-- Only an owner saves, and only their own page (design 3 §5; E6, E33).
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f2');
select throws_ok($$ select public.owner_save_page(null, 'a_dreamy', 'en', null, null, 'UTC', '{}') $$,
  '42501', null, 'a co-editor cannot create or save a page (E33)');
select is(public.owner_page(), null, 'a co-editor has no page of their own');
select is((select p.theme::text || ' ' || p.version from public.pages p where p.id = '00000000-0000-0000-0000-00000000000a'),
  'a_dreamy 1', 'another owner''s page is untouched (E6)');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select is(public.owner_save_page(1, 'd_elegant', 'en', 'Partner A', 'Partner B', 'UTC', '{memories}'), 2,
  'an owner saves their own page');
select is((select p.theme::text from public.pages p where p.id = pg_temp.page_of('00000000-0000-0000-0000-0000000000f6')),
  'a_dreamy', 'and nobody else''s (E6)');

-- A finished setup is not reopened through this function until Q115 decides how (Q114).
update public.pages set setup_completed_at = now() where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select throws_ok($$ select public.owner_save_page(3, 'b_cosmic', 'vi', 'Partner A', 'Partner B', 'UTC', '{together}') $$,
  '55000', null, 'a page whose setup is finished cannot be saved through setup');
select is((select p.theme::text || ' ' || p.version from public.pages p where p.id = '00000000-0000-0000-0000-00000000000a'),
  'd_elegant 3', 'the finished page kept its choices');
select is((select array_agg(s.section::text order by s.sort_order) from public.page_sections s
    where s.page_id = '00000000-0000-0000-0000-00000000000a' and s.enabled),
  array['home', 'memories'], 'and its sections');

-- Guests see nothing of an unfinished page (E55, design 3 §3.12).
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f6');
select throws_ok($$ select public.owner_set_visibility('token_only') $$, '55000', null,
  'the new page cannot leave Private before its wording is published');
select is(public.guest_open(public.owner_rotate_token(gen_random_uuid())), null,
  'a guest link made for the unfinished page opens nothing (E55)');

select * from finish();
rollback;
