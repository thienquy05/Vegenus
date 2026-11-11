-- Items CRUD with draft and publish (T2.2; owner UI O4, O5; design 3 §1 principle 3, §1.6, §3.3; PRD E15, E6,
-- E33, E56). owner_item_save creates a draft under an id the screen chose (so a retry cannot duplicate it) or
-- updates one that the caller names by version; owner_item_set_status publishes a snapshot that guests read
-- until the next Publish, or unpublishes; owner_item_delete removes. A stale or foreign id changes nothing and
-- answers null or false, the same for both (E56). The two-session race is in owner_items_race.test.sql.
-- Placeholder data only.
begin;
select plan(48);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000e2', 'coeditor@example.test'),
  ('00000000-0000-0000-0000-0000000000e3', 'other-owner@example.test');
insert into public.pages (id, theme, default_lang, visibility, timezone, copy_published_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'a_dreamy', 'en', 'token_only', 'UTC', now()),
  ('00000000-0000-0000-0000-0000000000a3', 'c_cozy', 'en', 'token_only', 'UTC', now());
insert into public.memberships (page_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1', 'owner'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e2', 'co_editor'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000e3', 'owner');
update public.page_sections set enabled = true;

create function pg_temp.act_as(id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
$$;
-- A memory with placeholder fields; only the id, the version and the title vary.
create function pg_temp.save(item uuid, ver int, title text) returns jsonb language sql as $$
  select public.owner_item_save(save.item, save.ver, 'memory', 'en', save.title, 'Body', null, null, null,
    date '2024-05-01', 'day', false, false)
$$;
create function pg_temp.id_of(title text) returns uuid language sql as $$
  select i.id from public.items i where i.title = id_of.title
$$;
-- The titles guests see in Memories on page a1.
create function pg_temp.live() returns text[] language sql as $$
  select coalesce(array_agg(l.title order by l.sort_order), '{}')
  from public.list_items('00000000-0000-0000-0000-0000000000a1', 'memories', null, null) l
$$;
create function pg_temp.listed(id uuid) returns jsonb language sql as $$
  select e from jsonb_array_elements(public.owner_items_list('memories')) e where e ->> 'id' = listed.id::text
$$;

-- Who may call them.
select throws_ok($$ set local role anon; select public.owner_items_list('memories') $$, '42501', null,
  'anon cannot call the item functions');
reset role;
select ok(has_function_privilege('authenticated', 'public.owner_items_list(public.section_id)', 'execute')
  and not has_function_privilege('vegenus_server', 'public.owner_items_list(public.section_id)', 'execute'),
  'authenticated can call owner_items_list; vegenus_server cannot');
select throws_ok($$ select pg_temp.save(gen_random_uuid(), null, 'Title') $$, '42501', null, 'no signed-in user is refused');

-- The owner creates drafts under ids the screen chose.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select is(pg_temp.save('00000000-0000-0000-0000-0000000000b1', null, 'First'),
  jsonb_build_object('id', '00000000-0000-0000-0000-0000000000b1', 'version', 1), 'creating returns the id and version 1');
select is((select i.status::text || ' ' || i.page_id from public.items i where i.title = 'First'),
  'draft 00000000-0000-0000-0000-0000000000a1', 'the new item is a draft on the owner''s page');
select is((select i.created_by from public.items i where i.title = 'First'),
  '00000000-0000-0000-0000-0000000000e1'::uuid, 'and records who created it');
select is(pg_temp.save('00000000-0000-0000-0000-0000000000b1', null, 'First'),
  jsonb_build_object('id', '00000000-0000-0000-0000-0000000000b1', 'version', 1),
  'a retried create answers the item it made the first time');
select is((select count(*) from public.items), 1::bigint, 'and makes no second item');
select is(pg_temp.save('00000000-0000-0000-0000-0000000000b1', null, 'First, changed'), null,
  'a retried create with different content answers no version (Codex round 2)');
select is((select i.title from public.items i where i.id = '00000000-0000-0000-0000-0000000000b1'), 'First',
  'and the stored item keeps the content that was saved');
select pg_temp.save('00000000-0000-0000-0000-0000000000b2', null, 'Second');
select ok((select b.sort_order > a.sort_order from public.items a, public.items b
  where a.title = 'First' and b.title = 'Second'), 'a new item goes to the end of its section');

-- Updates name the version they read (E15).
select is((pg_temp.save(pg_temp.id_of('First'), 1, 'First, edited') ->> 'version')::int, 2,
  'a save naming the current version updates the item and returns the next one');
select is((select i.title || ' ' || i.updated_by from public.items i where i.id = pg_temp.id_of('First, edited')),
  'First, edited 00000000-0000-0000-0000-0000000000e1', 'the update is stored with its editor');
select is(pg_temp.save(pg_temp.id_of('First, edited'), 1, 'Stale'), null, 'a save naming an old version changes nothing (E15)');
select is((select i.title from public.items i where i.id = pg_temp.id_of('First, edited')), 'First, edited',
  'the stale save left the item as it was');
select is(pg_temp.save(pg_temp.id_of('First, edited'), null, 'First'), null,
  'a create retried after the item was edited changes nothing and answers no version');
select is(pg_temp.save(gen_random_uuid(), 1, 'Ghost'), null, 'an id that does not exist changes nothing');
select throws_ok($$ select public.owner_item_save(pg_temp.id_of('First, edited'), 2, 'milestone', 'en', 'x', null,
    null, null, null, date '2024-05-01', 'day', false, false) $$, '22023', null, 'the kind of an item cannot change');
select throws_ok($$ select public.owner_item_save(null, null, 'memory', 'en', 'No id', null, null, null, null,
    date '2024-05-01', 'day', false, false) $$, '22023', null, 'a create needs the id the screen chose');
select throws_ok($$ select public.owner_item_save(gen_random_uuid(), null, 'home', 'en', 'Home', null, null, null, null,
    null, null, false, false) $$, '22023', null, 'home items are not created here (T2.4)');
select throws_ok($$ select public.owner_item_save(gen_random_uuid(), null, 'zodiac_sign', 'en', 'Sign', null, null, null, null,
    null, null, false, false) $$, '22023', null, 'zodiac items are not created here (T3.9)');

-- Bad input is refused and changes nothing.
select throws_ok($$ select pg_temp.save(gen_random_uuid(), null, '') $$, '23514', null, 'an empty title is refused');
select throws_ok($$ select pg_temp.save(gen_random_uuid(), null, normalize('Á', nfd)) $$, '23514', null, 'a title not in NFC is refused');
select throws_ok($$ select public.owner_item_save(gen_random_uuid(), null, 'anniversary', 'en', 'Anniv', null, null, null, null,
    date '2024-05-01', 'month', true, false) $$, '23514', null, 'an anniversary needs day precision (per-kind check)');
select is((select count(*) from public.items), 2::bigint, 'the refused saves created nothing');

-- Another owner's items and a co-editor (E6, E33, E56).
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e3');
select is(pg_temp.save(pg_temp.id_of('First, edited'), 2, 'Hijack'), null, 'saving another page''s item changes nothing (E6)');
select is(pg_temp.save(pg_temp.id_of('Second'), null, 'Hijack'), null, 'creating under another page''s id changes nothing (E56)');
select is(public.owner_item_get(pg_temp.id_of('First, edited')), null, 'reading another page''s item answers null');
select is(jsonb_array_length(public.owner_items_list('memories')), 0, 'the list holds only the caller''s items');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e2');
select throws_ok($$ select pg_temp.save(gen_random_uuid(), null, 'By co-editor') $$, '42501', null, 'a co-editor cannot create items (E33)');
select throws_ok($$ select public.owner_item_delete(pg_temp.id_of('Second'), 1) $$, '42501', null, 'a co-editor cannot delete items');

-- Publishing: guests read the published snapshot, never the working copy (design 3 §1 principle 3).
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select is(pg_temp.live(), '{}'::text[], 'guests see no draft');
select is(public.owner_item_set_status(pg_temp.id_of('First, edited'), 1, 'published'), null, 'publishing with a stale version changes nothing');
select is(public.owner_item_set_status(pg_temp.id_of('First, edited'), 2, 'published'), 3, 'publishing returns the next version');
select is(pg_temp.live(), array['First, edited'], 'guests see the published item');
select is(pg_temp.listed(pg_temp.id_of('First, edited')) ->> 'unpublished_changes', 'false', 'the owner sees no unpublished changes');
select pg_temp.save(pg_temp.id_of('First, edited'), 3, 'First, live edit');
select is(pg_temp.live(), array['First, edited'], 'a save to a published item leaves guests on the published version');
select is(pg_temp.listed(pg_temp.id_of('First, live edit')) ->> 'unpublished_changes', 'true', 'and the owner sees changes not published');
select is(public.owner_item_set_status(pg_temp.id_of('First, live edit'), 4, 'published'), 5, 'publishing again returns the next version');
select is(pg_temp.live(), array['First, live edit'], 'guests now see the new version');
select is(public.owner_item_set_status(pg_temp.id_of('First, live edit'), 5, 'draft'), 6, 'unpublishing returns the next version');
select is(pg_temp.live(), '{}'::text[], 'guests no longer see it');

-- The list and the single read give the owner every item, drafts included.
select is(jsonb_array_length(public.owner_items_list('memories')), 2, 'the list holds both items');
select is(public.owner_item_get(pg_temp.id_of('First, live edit')) ->> 'title', 'First, live edit', 'the single read gives the item');

-- Deleting.
select is(public.owner_item_delete(pg_temp.id_of('Second'), 9), false, 'deleting with a stale version removes nothing');
select is(public.owner_item_delete(pg_temp.id_of('Second'), 1), true, 'deleting with the current version removes the item');
select is(pg_temp.save('00000000-0000-0000-0000-0000000000b2', null, 'Second'), null,
  'a create retried after the item was deleted does not bring it back (Codex round 2)');
select is((select count(*) from public.items where id = '00000000-0000-0000-0000-0000000000b2'), 0::bigint,
  'the deleted item stays deleted');

select * from finish();
rollback;
