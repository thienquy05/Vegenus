-- Page settings O19 (T2.8; owner UI "O19 Page settings"; Q115). E15, E33.
-- One save per panel (names and default language, time zone, suggested theme) for a finished page: only the touched
-- fields, each with the saved value it was edited against (null: "conflict"); a request id makes a retry of a
-- committed save answer the snapshot without applying twice; every success answers the owner_page() snapshot.
-- Placeholder data only.
begin;
select plan(42);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000f2', 'coeditor@example.test'),
  ('00000000-0000-0000-0000-0000000000f4', 'new-owner@example.test'),
  ('00000000-0000-0000-0000-0000000000f5', 'stranger@example.test');
-- A: f1's finished page. N: f4's page, setup not finished.
insert into public.pages (id, theme, default_lang, label_a, label_b, visibility, timezone, copy_published_at, setup_completed_at) values
  ('00000000-0000-0000-0000-00000000000a', 'a_dreamy', 'en', 'Partner A', 'Partner B', 'token_only', 'Asia/Ho_Chi_Minh', now(), now()),
  ('00000000-0000-0000-0000-00000000000e', null, 'en', 'Partner C', 'Partner D', 'private', 'UTC', null, null);
insert into public.memberships (page_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f1', 'owner'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f2', 'co_editor'),
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-0000000000f4', 'owner');

create function pg_temp.act_as(id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.page() returns public.pages language sql as $$
  select * from public.pages where id = '00000000-0000-0000-0000-00000000000a'
$$;

-- Who may call it.
select throws_ok($$ set local role anon; select public.owner_save_settings('theme', '{"theme": null}', '{"theme": null}', gen_random_uuid()) $$,
  '42501', null, 'anon cannot call owner_save_settings');
reset role;
select ok(has_function_privilege('authenticated', 'public.owner_save_settings(text, jsonb, jsonb, uuid)', 'execute'),
  'authenticated can call owner_save_settings');
select ok(not has_function_privilege('vegenus_server', 'public.owner_save_settings(text, jsonb, jsonb, uuid)', 'execute'),
  'vegenus_server cannot call it');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f5');
select throws_ok($$ select public.owner_save_settings('theme', '{"theme": "a_dreamy"}', '{"theme": null}', gen_random_uuid()) $$,
  '42501', null, 'a user without a membership cannot save settings (E33)');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f2');
select throws_ok($$ select public.owner_save_settings('theme', '{"theme": "a_dreamy"}', '{"theme": null}', gen_random_uuid()) $$,
  '42501', null, 'a co-editor cannot save settings (design 3 §5, E33)');

-- Names and the default language, committed together.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
create temp table n1 as select public.owner_save_settings('names',
  '{"label_a": "Partner A", "label_b": "Partner B", "default_lang": "en"}',
  '{"label_a": "Partner E", "label_b": "Partner F", "default_lang": "vi"}', '00000000-0000-0000-0000-0000000000c1') snap;
select is((select snap from n1), public.owner_page(), 'a names save answers the owner_page() snapshot');
select is(((pg_temp.page()).label_a, (pg_temp.page()).label_b, (pg_temp.page()).default_lang::text),
  ('Partner E'::text, 'Partner F'::text, 'vi'::text), 'the names and the default language are saved');
select is((pg_temp.page()).version, 2, 'the save moves the page version on (E15)');
select is((select array_agg(kind order by kind) from public.settings_saves
  where page_id = '00000000-0000-0000-0000-00000000000a' and request_id = '00000000-0000-0000-0000-0000000000c1'),
  array['names'], 'the committed request id is recorded under its panel');

-- A retry of a committed save (the same base and fields, now stale) answers the current snapshot and applies nothing:
-- the request id is looked up before the bases, so it is not a conflict.
select is(public.owner_save_settings('names',
  '{"label_a": "Partner A", "label_b": "Partner B", "default_lang": "en"}',
  '{"label_a": "Partner E", "label_b": "Partner F", "default_lang": "vi"}', '00000000-0000-0000-0000-0000000000c1'),
  public.owner_page(), 'a retry of a committed request answers the snapshot');
select is((pg_temp.page()).label_a, 'Partner E', 'a retry does not apply again');
select is((pg_temp.page()).version, 2, 'a retry does not move the version on');

-- Only the touched fields change; each is compared with the base it was edited against.
select is(public.owner_save_settings('names', '{"label_b": "Partner F"}', '{"label_b": "Partner G"}', gen_random_uuid()) ->> 'label_b',
  'Partner G', 'one touched name is saved');
select is(((pg_temp.page()).label_a, (pg_temp.page()).default_lang::text), ('Partner E'::text, 'vi'::text),
  'untouched fields keep their saved values');
select is(public.owner_save_settings('names', '{"label_a": "Partner A"}', '{"label_a": "Partner Y"}', gen_random_uuid()), null,
  'a base that differs from the saved value is a conflict');
select is((pg_temp.page()).label_a, 'Partner E', 'a conflict changes nothing');
select is((select count(*)::int from public.settings_saves where page_id = '00000000-0000-0000-0000-00000000000a'), 2,
  'a conflict records no request id');

-- The default language must be complete in the published wording (pages_wording_guard).
set local session_replication_role = replica;
update public.page_copy set published_text = null
  where page_id = '00000000-0000-0000-0000-00000000000a' and lang = 'en'
    and key = (select min(key) from public.copy_keys);
set local session_replication_role = origin;
select is(public.owner_save_settings('names', '{"label_a": "Partner E", "default_lang": "vi"}',
  '{"label_a": "Partner Z", "default_lang": "en"}', gen_random_uuid()), '{"error": "wording_incomplete"}'::jsonb,
  'a default language with incomplete published wording is refused');
select is(((pg_temp.page()).label_a, (pg_temp.page()).default_lang::text), ('Partner E'::text, 'vi'::text),
  'the refusal saves neither the names nor the language');
select is(((select count(*)::int from public.settings_saves where page_id = '00000000-0000-0000-0000-00000000000a'), (pg_temp.page()).version),
  (2, 3), 'the refusal records no request id and keeps the version');

-- Time zone.
select is(public.owner_save_settings('timezone', '{"timezone": "Asia/Ho_Chi_Minh"}', '{"timezone": "Not/A_Zone"}', gen_random_uuid()),
  '{"error": "invalid_timezone"}'::jsonb, 'a zone the database does not know is refused');
select is((pg_temp.page()).timezone, 'Asia/Ho_Chi_Minh', 'the refused zone is not saved');
select is(((select count(*)::int from public.settings_saves where page_id = '00000000-0000-0000-0000-00000000000a'), (pg_temp.page()).version),
  (2, 3), 'the zone refusal records no request id and keeps the version');
select is(public.owner_save_settings('timezone', '{"timezone": "Asia/Ho_Chi_Minh"}', '{"timezone": "Europe/Paris"}', gen_random_uuid()) ->> 'timezone',
  'Europe/Paris', 'a known zone is saved');

-- Suggested theme: null is No suggestion, and a null base matches a null saved value.
select is(public.owner_save_settings('theme', '{"theme": "a_dreamy"}', '{"theme": null}', '00000000-0000-0000-0000-0000000000c1') -> 'theme',
  'null'::jsonb, 'No suggestion is saved as null; request ids are kept per panel');
select is(public.owner_save_settings('theme', '{"theme": null}', '{"theme": "c_cozy"}', gen_random_uuid()) ->> 'theme',
  'c_cozy', 'a null base matches a null saved theme');
select is(public.owner_save_settings('theme', '{"theme": null}', '{"theme": "d_elegant"}', gen_random_uuid()), null,
  'a null base against a saved theme is a conflict');

-- Only a default language change can be refused as wording_incomplete: any other 55000 on the update is raised as
-- P0001, so the route answers an unknown outcome rather than "setup not finished".
create function public.test_refuse_update() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'another rule' using errcode = '55000';
end
$$;
create trigger test_refuse_update before update on public.pages for each row execute function public.test_refuse_update();
select throws_ok($$ select public.owner_save_settings('theme', '{"theme": "c_cozy"}', '{"theme": "b_cosmic"}', gen_random_uuid()) $$,
  'P0001', 'another rule', 'a 55000 outside the wording guard is reported as neither wording_incomplete nor setup');
drop trigger test_refuse_update on public.pages;

-- Before Finish the wizard owns these choices.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f4');
select throws_ok($$ select public.owner_save_settings('theme', '{"theme": null}', '{"theme": "c_cozy"}', gen_random_uuid()) $$,
  '55000', null, 'a settings save before Finish is refused');

-- Malformed calls are refused.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select throws_ok($$ select public.owner_save_settings('theme', '{"theme": "c_cozy"}', '{"theme": null}', null) $$,
  '22023', null, 'a save needs a request id');
select throws_ok($$ select public.owner_save_settings('colour', '{"theme": "c_cozy"}', '{"theme": null}', gen_random_uuid()) $$,
  '22023', null, 'an unknown panel is refused');
select throws_ok($$ select public.owner_save_settings('names', '{"timezone": "UTC"}', '{"timezone": "UTC"}', gen_random_uuid()) $$,
  '22023', null, 'a field from another panel is refused');
select throws_ok($$ select public.owner_save_settings('names', '{}', '{}', gen_random_uuid()) $$,
  '22023', null, 'a save with no field is refused');
select throws_ok($$ select public.owner_save_settings('names', '{"label_a": "Partner E"}', '{"label_b": "Partner H"}', gen_random_uuid()) $$,
  '22023', null, 'every field needs its base');
select throws_ok($$ select public.owner_save_settings('names', '{"label_a": "Partner E"}', '{"label_a": null}', gen_random_uuid()) $$,
  '22023', null, 'a name cannot be removed');
select throws_ok(format($$ select public.owner_save_settings('names', '{"label_a": "Partner E"}', '{"label_a": "Partner%sE"}', gen_random_uuid()) $$,
  chr(8238)), '22023', null, 'a name with a bidirectional character is refused');
select throws_ok(format($$ select public.owner_save_settings('names', '{"label_a": "Partner E"}', '{"label_a": "Partner%sE"}', gen_random_uuid()) $$,
  chr(1564)), '22023', null, 'a name with an Arabic letter mark is refused');
select throws_ok(format($$ select public.owner_save_settings('names', '{"label_a": "Partner E"}', '{"label_a": "Partner%sE"}', gen_random_uuid()) $$,
  chr(8206)), '22023', null, 'a name with a left-to-right mark is refused');
select throws_ok(format($$ select public.owner_save_settings('names', '{"label_a": "Partner E"}', '{"label_a": "Partner%sE"}', gen_random_uuid()) $$,
  chr(8294)), '22023', null, 'a name with a bidirectional isolate is refused');
select throws_ok($$ select public.owner_save_settings('names', '{"label_a": "Partner E"}', '{"label_a": " Partner E"}', gen_random_uuid()) $$,
  '22023', null, 'a name with a space at either end is refused');
select throws_ok(format($$ select public.owner_save_settings('names', '{"label_a": "Partner E"}', '{"label_a": "%s"}', gen_random_uuid()) $$,
  repeat('x', 41)), '23514', null, 'a name over 40 characters is refused');
select is((pg_temp.page()).label_a, 'Partner E', 'refused saves change nothing');

select * from finish();
rollback;
