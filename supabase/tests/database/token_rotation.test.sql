-- Guest token create and rotation (T1.5b; design 1 §3.1, §3.2, §6; design 3 §3.2, §5). E3, E28, E33.
-- The owner is the caller's auth.uid(); the raw token is returned once and only its hash is stored.
-- Concurrent rotations need two connections: e2e/token-rotation.spec.ts. Placeholder data only.
begin;
select plan(22);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000f2', 'coeditor@example.test'),
  ('00000000-0000-0000-0000-0000000000f3', 'stranger@example.test');
insert into public.pages (id, theme, default_lang, visibility, timezone, copy_published_at) values
  ('00000000-0000-0000-0000-00000000000a', 'a_dreamy', 'en', 'token_only', 'UTC', now());
update public.page_sections set enabled = true where section = 'home';
insert into public.memberships (page_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f1', 'owner'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f2', 'co_editor');

-- auth.uid() reads the JWT claims PostgREST sets for each request.
create function pg_temp.act_as(id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
$$;

-- Who may call it.
select throws_ok($$ set local role anon; select public.owner_rotate_token(gen_random_uuid()) $$,
  '42501', null, 'anon cannot call owner_rotate_token');
reset role;
select ok(has_function_privilege('authenticated', 'public.owner_rotate_token(uuid)', 'execute'),
  'authenticated can call owner_rotate_token');
select ok(not has_function_privilege('vegenus_server', 'public.owner_rotate_token(uuid)', 'execute'),
  'vegenus_server cannot call owner_rotate_token');

select throws_ok($$ select public.owner_rotate_token(gen_random_uuid()) $$,
  '42501', null, 'no signed-in user is refused');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f3');
select throws_ok($$ select public.owner_rotate_token(gen_random_uuid()) $$,
  '42501', null, 'a user without a membership is refused (E33)');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f2');
select throws_ok($$ select public.owner_rotate_token(gen_random_uuid()) $$,
  '42501', null, 'a co-editor cannot rotate (design 3 §5, E33)');
select is((select count(*) from public.guest_tokens), 0::bigint, 'refused calls create no token');

-- Create: the first token of the page.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
create temp table t1 as select public.owner_rotate_token('00000000-0000-0000-0000-000000000001') as token;
select matches((select token from t1), '^[A-Za-z0-9_-]{43}$', 'the token is 32 random bytes in base64url (design 1 §3)');
select is(public.token_page((select token from t1)), '00000000-0000-0000-0000-00000000000a'::uuid, 'the new token opens the page');
select results_eq($$ select version, active, created_by, shown_at, token_hash from public.guest_tokens $$,
  $$ values (1, true, '00000000-0000-0000-0000-0000000000f1'::uuid, null::timestamptz, sha256(convert_to((select token from t1), 'UTF8'))) $$,
  'version 1 is active, stores only the hash, and is not marked shown yet');

-- A pending wish posted with version 1 (design 1 §6).
insert into public.guestbook_entries (page_id, display_name, body, lang, submission_id, author_kind, token_version) values
  ('00000000-0000-0000-0000-00000000000a', '[GUEST]', 'Pending before rotation', 'en', gen_random_uuid(), 'token', 1);

-- Rotate (E3).
create temp table t2 as select public.owner_rotate_token('00000000-0000-0000-0000-000000000002') as token;
select isnt((select token from t2), (select token from t1), 'rotation returns a new token');
select is(public.token_page((select token from t1)), null, 'the old token no longer opens the page');
select is(public.guest_open((select token from t1)), null, 'guest_open with the old token returns nothing');
select isnt(public.guest_open((select token from t2)), null, 'guest_open with the new token opens the page');
select results_eq($$ select version, active, deactivated_at is not null from public.guest_tokens order by version $$,
  $$ values (1, false, true), (2, true, false) $$,
  'version 1 is inactive with deactivated_at, version 2 is the one active token');
select results_eq($$ select status::text, token_version from public.guestbook_entries $$,
  $$ values ('pending', 1) $$, 'the pending wish stays in the queue with the old version label');

-- Retry with the same request id: "already rotated", never a second token or the link again (Q34a).
select is(public.owner_rotate_token('00000000-0000-0000-0000-000000000002'), null, 'a repeated request id returns nothing');
select is((select count(*) from public.guest_tokens), 2::bigint, 'a repeated request id creates no token');
select is(public.token_page((select token from t2)), '00000000-0000-0000-0000-00000000000a'::uuid, 'the current token still works after a retry');

-- One more rotation: still exactly one active token, versions keep counting.
select isnt(public.owner_rotate_token('00000000-0000-0000-0000-000000000003'), null, 'a new request id rotates again');
select results_eq($$ select array_agg(version order by version), count(*) filter (where active) from public.guest_tokens $$,
  $$ values (array[1, 2, 3], 1::bigint) $$, 'three versions, one active');

-- The function rejects a request id it cannot use.
select throws_ok($$ select public.owner_rotate_token(null) $$, '22023', null, 'a missing request id is refused');

select * from finish();
rollback;
