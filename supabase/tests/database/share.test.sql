-- Share O8 and visibility O9 (T2.6; owner UI "O8 Share and O9 Visibility"; Q146 10-44). E6, E33.
-- owner_page() carries the active link's metadata (never the token); O8 acknowledges a revealed version once;
-- the O9 saves are idempotent by request id and answer the owner_page() snapshot; the sections save checks the
-- flags the draft was based on. Rotation itself: token_rotation.test.sql. Placeholder data only.
begin;
select plan(44);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000f2', 'coeditor@example.test'),
  ('00000000-0000-0000-0000-0000000000f3', 'other-owner@example.test'),
  ('00000000-0000-0000-0000-0000000000f4', 'new-owner@example.test'),
  ('00000000-0000-0000-0000-0000000000f5', 'stranger@example.test');
-- A: f1's finished Token-only page. B: f3's finished page. N: f4's page, setup not finished.
insert into public.pages (id, theme, default_lang, visibility, timezone, copy_published_at, setup_completed_at) values
  ('00000000-0000-0000-0000-00000000000a', 'a_dreamy', 'en', 'token_only', 'Asia/Ho_Chi_Minh', now(), now()),
  ('00000000-0000-0000-0000-00000000000b', 'b_cosmic', 'vi', 'token_only', 'UTC', now(), now()),
  ('00000000-0000-0000-0000-00000000000e', 'c_cozy', 'en', 'private', 'UTC', null, null);
update public.page_sections set enabled = true where section in ('home', 'memories');
insert into public.memberships (page_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f1', 'owner'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f2', 'co_editor'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000f3', 'owner'),
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-0000000000f4', 'owner');

create function pg_temp.act_as(id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.sections(id uuid) returns text[] language sql as $$
  select array_agg(s.section::text order by s.sort_order) from public.page_sections s where s.page_id = id and s.enabled
$$;

-- Who may call the new functions.
select throws_ok($$ set local role anon; select public.owner_token_shown(1) $$, '42501', null, 'anon cannot call owner_token_shown');
reset role;
select throws_ok($$ set local role anon; select public.owner_save_sections('{home}', '{home}', gen_random_uuid()) $$,
  '42501', null, 'anon cannot call owner_save_sections');
reset role;
select ok(has_function_privilege('authenticated', 'public.owner_token_shown(integer)', 'execute')
  and has_function_privilege('authenticated', 'public.owner_save_sections(public.section_id[], public.section_id[], uuid)', 'execute'),
  'authenticated can call owner_token_shown and owner_save_sections');
select ok(not has_function_privilege('vegenus_server', 'public.owner_token_shown(integer)', 'execute')
  and not has_function_privilege('vegenus_server', 'public.owner_save_sections(public.section_id[], public.section_id[], uuid)', 'execute'),
  'vegenus_server cannot call them');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000f5');
select throws_ok($$ select public.owner_token_shown(1) $$, '42501', null, 'a user without a membership cannot acknowledge (E33)');
select throws_ok($$ select public.owner_save_sections('{home}', '{home}', gen_random_uuid()) $$, '42501', null,
  'a user without a membership cannot save sections (E33)');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f2');
select throws_ok($$ select public.owner_token_shown(1) $$, '42501', null, 'a co-editor cannot acknowledge (design 3 §5, E33)');
select throws_ok($$ select public.owner_save_sections('{home}', '{home}', gen_random_uuid()) $$, '42501', null,
  'a co-editor cannot save sections (design 3 §5, E33)');

-- owner_page(): the link's metadata, never the token (Q146 16, design 1 §3.2).
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select is(public.owner_page() -> 'link', 'null'::jsonb, 'no link yet: link is null');
select is(public.owner_page() ->> 'timezone', 'Asia/Ho_Chi_Minh', 'the snapshot carries the page time zone');
insert into public.guest_tokens (page_id, version, token_hash, request_id, active, deactivated_at, created_at) values
  ('00000000-0000-0000-0000-00000000000a', 1, sha256('token-a1'::bytea), gen_random_uuid(), false, now(), now() - interval '1 day');
insert into public.guest_tokens (page_id, version, token_hash, request_id) values
  ('00000000-0000-0000-0000-00000000000a', 2, sha256('token-a2'::bytea), gen_random_uuid()),
  ('00000000-0000-0000-0000-00000000000b', 1, sha256('token-b1'::bytea), gen_random_uuid());
select is((select array_agg(k order by k) from jsonb_object_keys(public.owner_page() -> 'link') k),
  array['created_at', 'shown_at', 'version'], 'link has exactly version, created_at and shown_at');
select is((public.owner_page() -> 'link' ->> 'version')::int, 2, 'link is the active version');
select is((public.owner_page() -> 'link' ->> 'created_at')::timestamptz,
  (select date_trunc('milliseconds', created_at) from public.guest_tokens where page_id = '00000000-0000-0000-0000-00000000000a' and version = 2),
  'link.created_at is the active version''s');
-- ISO UTC whatever the session time zone (Q146 29; review T2.6a).
set local timezone = 'Asia/Ho_Chi_Minh';
select matches(public.owner_page() -> 'link' ->> 'created_at', '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$',
  'link.created_at is ISO UTC with a Z, in any session time zone');
reset timezone;
select is(public.owner_page() -> 'link' -> 'shown_at', 'null'::jsonb, 'a link not yet acknowledged has shown_at null');

-- owner_token_shown: one idempotent acknowledgement per version, only while it is active (Q146 12).
select is(public.owner_token_shown(1), false, 'an inactive version cannot be acknowledged');
select is((select shown_at from public.guest_tokens where page_id = '00000000-0000-0000-0000-00000000000a' and version = 1), null,
  'the inactive version stays unacknowledged');
select is(public.owner_token_shown(2), true, 'the active version is acknowledged');
create temp table shown as select shown_at from public.guest_tokens where page_id = '00000000-0000-0000-0000-00000000000a' and version = 2;
select isnt((select shown_at from shown), null, 'shown_at is set');
update public.guest_tokens set shown_at = shown_at - interval '1 hour' where page_id = '00000000-0000-0000-0000-00000000000a' and version = 2;
select is(public.owner_token_shown(2), true, 'a repeated acknowledgement answers true');
select is((select shown_at from public.guest_tokens where page_id = '00000000-0000-0000-0000-00000000000a' and version = 2),
  (select shown_at - interval '1 hour' from shown), 'a repeated acknowledgement keeps the first shown_at');
select isnt(public.owner_page() -> 'link' -> 'shown_at', 'null'::jsonb, 'owner_page shows the acknowledgement');
set local timezone = 'Asia/Ho_Chi_Minh';
select matches(public.owner_page() -> 'link' ->> 'shown_at', '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$',
  'link.shown_at is ISO UTC with a Z, in any session time zone');
reset timezone;
select is((select shown_at from public.guest_tokens where page_id = '00000000-0000-0000-0000-00000000000b'), null,
  'another page''s link is untouched (E6)');
select throws_ok($$ select public.owner_token_shown(null) $$, '22023', null, 'a missing version is refused');

-- owner_set_visibility: the snapshot, and a retry of a committed save applies nothing (Q146 20, 35).
create temp table v1 as select public.owner_set_visibility('private', '00000000-0000-0000-0000-0000000000c1') as snap;
select is((select snap from v1), public.owner_page(), 'a visibility save answers the owner_page() snapshot');
select is((select snap ->> 'visibility' from v1), 'private', 'the snapshot shows the saved visibility');
select is(public.owner_set_visibility('token_only', '00000000-0000-0000-0000-0000000000c2') ->> 'visibility', 'token_only',
  'a new request id saves');
select is(public.owner_set_visibility('private', '00000000-0000-0000-0000-0000000000c1'), public.owner_page(),
  'a retry of a committed save answers the current snapshot');
select is(public.owner_page() ->> 'visibility', 'token_only', 'a retry of a committed save does not apply it twice');
-- Each save kind has its own request ids: an id a visibility save used never answers for a sections save (review T2.6a).
select is(public.owner_save_sections('{home,memories}', '{home,together}', '00000000-0000-0000-0000-0000000000c2') -> 'sections',
  '["home", "together"]'::jsonb, 'a sections save with an id a visibility save used is applied');
update public.page_sections set enabled = section in ('home', 'memories') where page_id = '00000000-0000-0000-0000-00000000000a';
select throws_ok($$ select public.owner_set_visibility('private', null) $$, '22023', null, 'a visibility save needs a request id');

-- owner_save_sections: base flags as the precondition, home always on, zodiac untouched (Q146 20, 21, 35).
create temp table s1 as select public.owner_save_sections('{memories,home}', '{home,together,guestbook}', '00000000-0000-0000-0000-0000000000d1') as snap;
select is((select snap from s1), public.owner_page(), 'a sections save answers the owner_page() snapshot');
select is(pg_temp.sections('00000000-0000-0000-0000-00000000000a'), array['home', 'together', 'guestbook'], 'the new sections are saved');
select is(public.owner_save_sections('{home,together,guestbook}', '{memories}', gen_random_uuid()) -> 'sections',
  '["home", "memories"]'::jsonb, 'home stays on when the draft leaves it out (Q118)');
select is(public.owner_save_sections('{home,together,guestbook}', '{home}', gen_random_uuid()), null,
  'a base that differs from the saved flags is a conflict');
select is(pg_temp.sections('00000000-0000-0000-0000-00000000000a'), array['home', 'memories'], 'a conflict changes nothing');
select is(public.owner_save_sections('{memories,home,memories}', '{home,guestbook}', gen_random_uuid()) -> 'sections',
  '["home", "guestbook"]'::jsonb, 'the base is compared as a set');
select is(public.owner_save_sections('{memories,home}', '{home,memories}', '00000000-0000-0000-0000-0000000000d1'), public.owner_page(),
  'a retry of a committed save answers the current snapshot, not a conflict');
select is(pg_temp.sections('00000000-0000-0000-0000-00000000000a'), array['home', 'guestbook'], 'the retry applies nothing');
update public.page_sections set enabled = true where page_id = '00000000-0000-0000-0000-00000000000a' and section = 'zodiac';
select is(public.owner_save_sections('{home,guestbook,zodiac}', '{home,memories}', gen_random_uuid()) -> 'sections',
  '["home", "memories", "zodiac"]'::jsonb, 'zodiac keeps its saved flag (hidden until T3.9)');
select throws_ok($$ select public.owner_save_sections('{home,memories,zodiac}', '{home,zodiac}', gen_random_uuid()) $$,
  '22023', null, 'zodiac cannot be switched from O9 yet');
select is(pg_temp.sections('00000000-0000-0000-0000-00000000000b'), array['home', 'memories'], 'another page''s sections are untouched (E6)');

-- Before Finish the wizard owns the sections (owner_save_page); O9 shows "Finish setup first."
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f4');
select throws_ok($$ select public.owner_save_sections('{home,memories}', '{home}', gen_random_uuid()) $$, '55000', null,
  'a sections save before Finish is refused');

select * from finish();
rollback;
