-- Owner visibility switch (T1.5c; design 1 §5.1, §6, §10.1; design 3 §3.1, §3.12). E4, E6, E33, E47.
-- The owner is the caller's auth.uid(); a page leaves Private only after its wording is published, and
-- the guest and public reads follow the new state on the next call. Placeholder data only.
begin;
select plan(26);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000f2', 'coeditor@example.test'),
  ('00000000-0000-0000-0000-0000000000f3', 'other-owner@example.test'),
  ('00000000-0000-0000-0000-0000000000f4', 'new-owner@example.test'),
  ('00000000-0000-0000-0000-0000000000f5', 'stranger@example.test');
-- A: live Token-only page of f1. B: f3's page. N: f4's page, setup not finished (wording never published).
insert into public.pages (id, theme, default_lang, visibility, timezone, vanity_name, copy_published_at) values
  ('00000000-0000-0000-0000-00000000000a', 'a_dreamy', 'en', 'token_only', 'UTC', 'page-a', now()),
  ('00000000-0000-0000-0000-00000000000b', 'b_cosmic', 'vi', 'token_only', 'UTC', 'page-b', now()),
  ('00000000-0000-0000-0000-00000000000e', 'c_cozy', 'en', 'private', 'UTC', 'page-n', null);
update public.page_sections set enabled = true where section in ('home', 'memories');
insert into public.memberships (page_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f1', 'owner'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f2', 'co_editor'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000f3', 'owner'),
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-0000000000f4', 'owner');
insert into public.guest_tokens (page_id, version, token_hash, request_id) values
  ('00000000-0000-0000-0000-00000000000a', 1, sha256('token-a'::bytea), gen_random_uuid()),
  ('00000000-0000-0000-0000-00000000000b', 1, sha256('token-b'::bytea), gen_random_uuid());
insert into public.items (page_id, kind, status, lang, title, event_date, date_precision) values
  ('00000000-0000-0000-0000-00000000000a', 'memory', 'published', 'en', 'A memory', '2020-01-01', 'day');

create function pg_temp.act_as(id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.visibility(id uuid) returns text language sql as $$
  select visibility::text from public.pages where pages.id = visibility.id
$$;

-- Who may call it.
select throws_ok($$ set local role anon; select public.owner_set_visibility('private') $$,
  '42501', null, 'anon cannot call owner_set_visibility');
reset role;
select ok(has_function_privilege('authenticated', 'public.owner_set_visibility(public.visibility)', 'execute'),
  'authenticated can call owner_set_visibility');
select ok(not has_function_privilege('vegenus_server', 'public.owner_set_visibility(public.visibility)', 'execute'),
  'vegenus_server cannot call owner_set_visibility');

select throws_ok($$ select public.owner_set_visibility('private') $$, '42501', null, 'no signed-in user is refused');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f5');
select throws_ok($$ select public.owner_set_visibility('private') $$, '42501', null,
  'a user without a membership is refused (E33)');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f2');
select throws_ok($$ select public.owner_set_visibility('private') $$, '42501', null,
  'a co-editor cannot change visibility (design 3 §5, E33)');
select is(pg_temp.visibility('00000000-0000-0000-0000-00000000000a'), 'token_only', 'refused calls change nothing');

-- Set Private while a guest holds the token (E4): the next read returns nothing.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select isnt(public.guest_open('token-a'), null, 'before: the token opens page A');
select lives_ok($$ select public.owner_set_visibility('private') $$, 'the owner sets page A Private');
select is(pg_temp.visibility('00000000-0000-0000-0000-00000000000a'), 'private', 'page A is Private');
select is(public.guest_open('token-a'), null, 'Private: guest_open returns nothing (E4)');
select is_empty($$ select * from public.guest_list('token-a', 'memories') $$, 'Private: guest_list returns nothing (E4)');
select is(public.public_open('page-a'), null, 'Private: public_open returns nothing');

-- Only the caller's own page changes (E6).
select is(pg_temp.visibility('00000000-0000-0000-0000-00000000000b'), 'token_only', 'another owner''s page is untouched');
select isnt(public.guest_open('token-b'), null, 'another page''s token still opens its page');

-- Back to Token-only: the same token works again; the page is still not public (E47).
select lives_ok($$ select public.owner_set_visibility('token_only') $$, 'the owner sets page A Token-only');
select isnt(public.guest_open('token-a'), null, 'Token-only: the token opens the page again');
select is(public.public_open('page-a'), null, 'Token-only: no-credential reads return nothing (E47)');

-- Published: readable with no credential, and the token keeps working.
select lives_ok($$ select public.owner_set_visibility('published') $$, 'the owner sets page A Published');
select isnt(public.public_open('page-a'), null, 'Published: public_open opens the page');
select isnt(public.guest_open('token-a'), null, 'Published: the token still opens the page');

select throws_ok($$ select public.owner_set_visibility(null) $$, '22023', null, 'a missing visibility is refused');

-- A page whose wording was never published cannot leave Private (design 3 §3.12).
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f4');
select throws_ok($$ select public.owner_set_visibility('token_only') $$, '55000', null,
  'Token-only is refused before the wording is published');
select throws_ok($$ select public.owner_set_visibility('published') $$, '55000', null,
  'Published is refused before the wording is published');
select lives_ok($$ select public.owner_set_visibility('private') $$, 'Private is always allowed');
select is(pg_temp.visibility('00000000-0000-0000-0000-00000000000e'), 'private', 'the unfinished page stays Private');

select * from finish();
rollback;
