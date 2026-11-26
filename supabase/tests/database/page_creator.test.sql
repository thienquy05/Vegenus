-- Security gate, Phase 2 (audit run 1, NV-4): only an account an admin marked as a page creator (auth app metadata,
-- which the account itself cannot change) may create a page, and never an anonymous account. An existing owner keeps
-- saving their page. Placeholder data only.
begin;
select plan(9);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, is_anonymous) values
  ('00000000-0000-0000-0000-0000000001c1', 'plain@example.test', '{}', '{}', false),
  ('00000000-0000-0000-0000-0000000001c2', 'self-flagged@example.test', '{}', '{"page_creator": true}', false),
  ('00000000-0000-0000-0000-0000000001c3', 'anonymous@example.test', '{"page_creator": true}', '{}', true),
  ('00000000-0000-0000-0000-0000000001c4', 'creator@example.test', '{"page_creator": true}', '{}', false),
  ('00000000-0000-0000-0000-0000000001c5', 'text-flag@example.test', '{"page_creator": "yes"}', '{}', false),
  ('00000000-0000-0000-0000-0000000001c6', 'existing@example.test', '{}', '{}', false),
  ('00000000-0000-0000-0000-0000000001c7', 'anonymous-owner@example.test', '{}', '{}', true);
insert into public.pages (id, theme, default_lang, timezone) values
  ('00000000-0000-0000-0000-0000000001ca', null, 'en', 'UTC'), ('00000000-0000-0000-0000-0000000001cb', null, 'en', 'UTC');
insert into public.memberships (page_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000001ca', '00000000-0000-0000-0000-0000000001c6', 'owner'),
  ('00000000-0000-0000-0000-0000000001cb', '00000000-0000-0000-0000-0000000001c7', 'owner');

create function pg_temp.as_user(id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true);
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000001c1');
select throws_ok($$ select public.owner_save_page(null, null, 'en', 'Partner A', 'Partner B', 'UTC', '{}') $$, '42501',
  null, 'an account no admin marked cannot create a page');
select pg_temp.as_user('00000000-0000-0000-0000-0000000001c2');
select throws_ok($$ select public.owner_save_page(null, null, 'en', 'Partner A', 'Partner B', 'UTC', '{}') $$, '42501',
  null, 'the account''s own user metadata does not count');
select pg_temp.as_user('00000000-0000-0000-0000-0000000001c3');
select throws_ok($$ select public.owner_save_page(null, null, 'en', 'Partner A', 'Partner B', 'UTC', '{}') $$, '42501',
  null, 'an anonymous account cannot create a page, even when marked');
select pg_temp.as_user('00000000-0000-0000-0000-0000000001c5');
select throws_ok($$ select public.owner_save_page(null, null, 'en', 'Partner A', 'Partner B', 'UTC', '{}') $$, '42501',
  null, 'only the JSON value true marks a creator');
select pg_temp.as_user('00000000-0000-0000-0000-0000000001cf'); -- a deleted account whose token still holds its id
select throws_ok($$ select public.owner_save_page(null, null, 'en', 'Partner A', 'Partner B', 'UTC', '{}') $$, '42501',
  null, 'a deleted account cannot create a page');
select is((select count(*) from public.memberships m where m.user_id in ('00000000-0000-0000-0000-0000000001c1',
  '00000000-0000-0000-0000-0000000001c2', '00000000-0000-0000-0000-0000000001c3', '00000000-0000-0000-0000-0000000001c5'))::int,
  0, 'no refused account got a page');

select pg_temp.as_user('00000000-0000-0000-0000-0000000001c4');
select is(public.owner_save_page(null, null, 'en', 'Partner A', 'Partner B', 'UTC', '{}'), 1, 'a marked account creates its page');
select pg_temp.as_user('00000000-0000-0000-0000-0000000001c6');
select is(public.owner_save_page(1, null, 'vi', 'Partner A', 'Partner B', 'UTC', '{}'), 2, 'an existing owner keeps saving their page');
select pg_temp.as_user('00000000-0000-0000-0000-0000000001c7');
select throws_ok($$ select public.owner_save_page(1, null, 'vi', 'Partner A', 'Partner B', 'UTC', '{}') $$, '42501',
  null, 'an anonymous account cannot save a page either, even one it holds');

select * from finish();
rollback;
