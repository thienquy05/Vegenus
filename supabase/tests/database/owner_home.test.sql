-- Home item for O17 and the O2 Home card (T2.4; owner UI "O17 Home editor"; PRD Q144; design 3 §3.3; E14, E15,
-- E53, E56). Home has no title; its note is at most 600 characters per language; its photos are up to seven picks
-- of ready photos from the page's memories, in order. Publish copies the picks' order for guests, Unpublish clears
-- it; a deleted photo drops out; a pick whose memory is unpublished stays, marked hidden. Home cannot be deleted.
-- The two-session first create is in owner_home_race.test.sql. Placeholder data only.
begin;
select plan(52);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000e2', 'coeditor@example.test'),
  ('00000000-0000-0000-0000-0000000000e3', 'other-owner@example.test');
insert into public.pages (id, theme, default_lang, visibility, timezone, copy_published_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'a_dreamy', 'en', 'token_only', 'Asia/Ho_Chi_Minh', now()),
  ('00000000-0000-0000-0000-0000000000a3', 'c_cozy', 'en', 'token_only', 'UTC', now());
insert into public.memberships (page_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1', 'owner'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e2', 'co_editor'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000e3', 'owner');
update public.page_sections set enabled = true;
-- b1 and b4 published memories, b2 a draft memory, b3 a published milestone, b9 another page's published memory.
insert into public.items (id, page_id, kind, lang, title, event_date, date_precision, status, published) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'memory', 'en', 'Beach', '2023-07-01', 'day', 'published', '{}'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'memory', 'en', 'Draft', '2024-01-01', 'day', 'draft', null),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000a1', 'milestone', 'en', 'Moved in', '2022-01-01', 'day', 'published', '{}'),
  ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000a1', 'memory', 'en', 'Newer', '2024-06-01', 'day', 'published', '{}'),
  ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-0000000000a3', 'memory', 'en', 'Other page', '2023-07-01', 'day', 'published', '{}');
-- c1, c2 ready photos of b1 (c2 first by position); c3 a ready video and c4 an unfinished photo of b1; c5 a ready
-- photo of the draft b2; c6 a ready photo of the milestone b3; c7 a ready photo of b4; c9 another page's photo.
insert into public.media (id, page_id, item_id, kind, state, position, width, height, alt, alt_alt) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'photo', 'ready', 1, 1600, 1200, 'A beach', 'Bãi biển'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'photo', 'ready', 0, 800, 600, null, null),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'video', 'ready', 2, 1280, 720, null, null),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'photo', 'uploading', 3, null, null, null, null),
  ('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'photo', 'ready', 0, 800, 600, null, null),
  ('00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b3', 'photo', 'ready', 0, 800, 600, null, null),
  ('00000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b4', 'photo', 'ready', 0, 800, 600, null, null),
  ('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b9', 'photo', 'ready', 0, 800, 600, null, null);
insert into public.media_variants (media_id, page_id, variant, bucket, path, mime, bytes, write_until) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'thumb', 'media-thumb', 'p/a1/c1/thumb', 'image/webp', 10, now()),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', 'thumb', 'media-thumb', 'p/a1/c2/thumb', 'image/webp', 10, now()),
  ('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000a1', 'thumb', 'media-thumb', 'p/a1/c5/thumb', 'image/webp', 10, now());

create function pg_temp.act_as(id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
$$;
-- Saves Home d1 at version ver (null: create) with this note, start date and picks.
create function pg_temp.save(ver int, note text, start date, picks uuid[]) returns jsonb language sql as $$
  select public.owner_home_save('00000000-0000-0000-0000-0000000000d1', save.ver, 'en', save.note, null, null, save.start, save.picks)
$$;
-- The media ids c<n>, in the order given.
create function pg_temp.ids(variadic n int[]) returns uuid[] language sql as $$
  select array_agg(('00000000-0000-0000-0000-0000000000c' || x)::uuid order by o) from unnest(ids.n) with ordinality t(x, o)
$$;
create function pg_temp.picks() returns jsonb language sql as $$
  select jsonb_path_query_array(public.owner_home_get(), '$.picks[*].media_id')
$$;
create function pg_temp.published_picks() returns uuid[] language sql as $$
  select coalesce(array_agg(hp.media_id order by hp.published_position), '{}') from public.home_picks hp
  where hp.item_id = '00000000-0000-0000-0000-0000000000d1' and hp.published_position is not null
$$;
create function pg_temp.version() returns int language sql as $$
  select i.version from public.items i where i.id = '00000000-0000-0000-0000-0000000000d1'
$$;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select is(public.owner_home_get(), null, 'before a Home exists the read is null (O2: Set up Home)');

-- Create, under an id the screen chose; a retry finds the Home it made.
select is(pg_temp.save(null, 'Welcome', '2020-02-29', pg_temp.ids(2, 1)) ->> 'version', '1', 'a first save creates the Home as version 1');
select is(pg_temp.save(null, 'Welcome', '2020-02-29', pg_temp.ids(2, 1)) ->> 'version', '1', 'the same create retried answers the same Home');
select is(pg_temp.save(null, 'Changed', '2020-02-29', pg_temp.ids(2, 1)), null, 'a create with other content under that id is refused');
select is(pg_temp.save(null, 'Welcome', '2020-02-29', pg_temp.ids(1, 2)), null, 'and so is one with the same note but other picks');
select is(public.owner_home_save('00000000-0000-0000-0000-0000000000d2', null, 'en', 'Second', null, null, null, '{}'), null,
  'a second Home under another id answers like a conflict, not an error (Q144 default 10)');
select is((select count(*) from public.items i where i.kind = 'home'), 1::bigint, 'and the page still has one Home');

-- The read.
select is(public.owner_home_get() ->> 'status', 'draft', 'a new Home is a draft');
select is(public.owner_home_get() ->> 'title', null, 'Home has no title (the couple title is the partner names)');
select is(public.owner_home_get() ->> 'start_date', '2020-02-29', 'and keeps its start date');
select is(public.owner_home_get() ->> 'timezone', 'Asia/Ho_Chi_Minh', 'the read names the page time zone the counter uses (Q115)');
select is(pg_temp.picks(), to_jsonb(pg_temp.ids(2, 1)), 'the picks read in the order saved');
select is(public.owner_home_get() -> 'picks' -> 1,
  '{"media_id": "00000000-0000-0000-0000-0000000000c1", "item_id": "00000000-0000-0000-0000-0000000000b1", "hidden": false,
    "alt": "A beach", "alt_alt": "Bãi biển", "width": 1600, "height": 1200,
    "preview": {"bucket": "media-thumb", "path": "p/a1/c1/thumb"}}'::jsonb,
  'a pick carries its memory, alt text, size and thumbnail');

-- Only ready photos of the page's memories can be picked; anything else is left out, not an error.
select is(pg_temp.save(1, 'Welcome', '2020-02-29', pg_temp.ids(3, 4, 6, 9, 1, 5)) ->> 'version', '2',
  'a save with ineligible picks is accepted');
select is(pg_temp.picks(), to_jsonb(pg_temp.ids(1, 5)),
  'and keeps only the ready photos of memories (no video, unfinished photo, milestone photo or other page''s photo)');
select is(public.owner_home_get() -> 'picks' -> 1 -> 'hidden', 'true'::jsonb,
  'a pick whose memory is unpublished stays, marked hidden');
select throws_ok($$ select pg_temp.save(2, 'Welcome', null, array(select gen_random_uuid() from generate_series(1, 8))) $$,
  '22023', null, 'more than seven picks are refused');
select throws_ok($$ select pg_temp.save(2, 'Welcome', null, pg_temp.ids(1, 1)) $$, '22023', null, 'a repeated pick is refused');
select throws_ok($$ select pg_temp.save(2, 'Welcome', null, null) $$, '22023', null, 'the picks must be a list');

-- Overwrite check (E15) and the note cap.
select is(pg_temp.save(1, 'Stale', null, '{}'), null, 'a save naming an old version changes nothing');
select is(public.owner_home_get() ->> 'body', 'Welcome', 'not the note');
select is(pg_temp.picks(), to_jsonb(pg_temp.ids(1, 5)), 'nor the picks');
select throws_ok($$ select pg_temp.save(2, repeat('a', 601), null, '{}') $$, '23514', null, 'a note over 600 characters is refused');
select throws_ok($$ select public.owner_home_save('00000000-0000-0000-0000-0000000000d1', 2, 'en', 'Hi', 'vi', repeat('a', 601), null, '{}') $$,
  '23514', null, 'and so is a second-language note over 600 characters');
select is(public.owner_home_save('00000000-0000-0000-0000-0000000000d1', 2, 'en', repeat('a', 600), 'vi', null, null, pg_temp.ids(1, 5)) ->> 'version', '3',
  'a 600-character note without a start date is accepted (E53)');
select is(public.owner_home_save('00000000-0000-0000-0000-0000000000b1', 1, 'en', 'Hi', null, null, null, '{}'), null,
  'a memory cannot be saved as Home');
select throws_ok($$ select public.owner_item_save('00000000-0000-0000-0000-0000000000b8', null, 'memory', 'en', null, null,
  null, null, null, date '2024-01-01', 'day', false, false) $$, '23514', null, 'other items still need a title');

-- Publish copies the note, start date and pick order for guests; later saves stay unpublished.
select pg_temp.save(3, 'Welcome', '2020-02-29', pg_temp.ids(1, 5));
select is(public.owner_item_set_status('00000000-0000-0000-0000-0000000000d1', 4, 'published'), 5, 'Home is published through the item status');
select is(pg_temp.published_picks(), pg_temp.ids(1, 5), 'with its picks in order');
select is(public.owner_home_get() -> 'unpublished_changes', 'false'::jsonb, 'and no unpublished changes');
select is((select l.body || ' ' || l.start_date from public.list_items('00000000-0000-0000-0000-0000000000a1', 'home', null, null) l),
  'Welcome 2020-02-29', 'guests read the published note and start date');
select pg_temp.save(5, 'Welcome', '2020-02-29', pg_temp.ids(2, 1));
select is(public.owner_home_get() -> 'unpublished_changes', 'true'::jsonb, 'a change of picks alone is an unpublished change');
select is(pg_temp.published_picks(), pg_temp.ids(1, 5), 'guests keep the published picks, including one removed from the draft');
select is(pg_temp.picks(), to_jsonb(pg_temp.ids(2, 1)), 'the owner sees the draft picks');
select is(public.owner_item_set_status('00000000-0000-0000-0000-0000000000d1', 6, 'published'), 7, 'publishing again');
select is(pg_temp.published_picks(), pg_temp.ids(2, 1), 'shows guests the new picks');
select is((select count(*) from public.home_picks hp where hp.position is null), 0::bigint, 'and forgets the removed one');

-- A deleted photo drops out of the draft and of what guests see.
delete from public.media where id = '00000000-0000-0000-0000-0000000000c1';
select is(pg_temp.picks(), to_jsonb(pg_temp.ids(2)), 'a deleted photo drops out of the picks');
select is(public.owner_home_get() -> 'unpublished_changes', 'false'::jsonb, 'without leaving an unpublished change');

-- Unpublish clears what guests see; Home cannot be deleted.
select is(public.owner_item_set_status('00000000-0000-0000-0000-0000000000d1', 7, 'draft'), 8, 'Home can be unpublished');
select is(pg_temp.published_picks(), '{}'::uuid[], 'guests then see no picks');
select is((select count(*) from public.list_items('00000000-0000-0000-0000-0000000000a1', 'home', null, null)), 0::bigint,
  'and no Home content');
select is(public.owner_item_delete('00000000-0000-0000-0000-0000000000d1', 8), false, 'Home cannot be deleted');
select is(pg_temp.version(), 8, 'and is unchanged');
select is(public.owner_upload_begin('00000000-0000-0000-0000-0000000000d1', 'photo', '{thumb,display}'), null,
  'Home takes no uploads of its own (Q144: its photos are picks)');

-- Unpublish after a published pick left the draft: the pick kept only for guests goes too.
select pg_temp.save(8, 'Welcome', '2020-02-29', pg_temp.ids(2, 7));
select public.owner_item_set_status('00000000-0000-0000-0000-0000000000d1', 9, 'published');
select pg_temp.save(10, 'Welcome', '2020-02-29', pg_temp.ids(2));
select is(public.owner_item_set_status('00000000-0000-0000-0000-0000000000d1', 11, 'draft'), 12,
  'Home can be unpublished after a published pick left the draft');
select is((select count(*) from public.home_picks hp where hp.position is null) || ' ' || cardinality(pg_temp.published_picks()),
  '0 0', 'no pick is kept for guests');

-- The picker: ready photos of published memories, grouped by memory, newest memory first.
select is(jsonb_path_query_array(public.owner_home_photos(), '$[*].item_id'),
  '["00000000-0000-0000-0000-0000000000b4", "00000000-0000-0000-0000-0000000000b1"]'::jsonb,
  'the picker lists published memories with ready photos only, newest first');
select is(public.owner_home_photos() -> 1,
  '{"item_id": "00000000-0000-0000-0000-0000000000b1", "lang": "en", "title": "Beach", "title_alt": null,
    "event_date": "2023-07-01", "date_precision": "day",
    "photos": [{"media_id": "00000000-0000-0000-0000-0000000000c2", "alt": null, "alt_alt": null, "width": 800, "height": 600,
      "preview": {"bucket": "media-thumb", "path": "p/a1/c2/thumb"}}]}'::jsonb,
  'each memory carries its title and date and its ready photos by position');

-- Only the page owner (E33, E56).
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e2');
select throws_ok($$ select pg_temp.save(12, 'Co-editor', null, '{}') $$, '42501', null, 'a co-editor cannot save Home');
select is(coalesce(public.owner_home_get()::text, 'null') || ' ' || public.owner_home_photos()::text, 'null []',
  'nor read it or the picker');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e3');
select is(pg_temp.save(null, 'Welcome', '2020-02-29', '{}'), null, 'another owner cannot take this Home''s id');

select * from finish();
rollback;
