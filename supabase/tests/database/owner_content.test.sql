-- Owner content read path for the O4 and O5 screens (owner UI "O4 Content list and O5 Item editor"; Q140; design 3
-- §3.3, §3.4). The list is ordered by date (Memories newest first, Together oldest first); the item read carries
-- its finished media with alt text and the file to preview; alt text is saved with the item, under its version;
-- removing the second language drops its alt text; the owner may read the files of their own page's media, so the
-- item route can sign preview URLs with the owner's session. Placeholder data only.
begin;
select plan(32);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000e2', 'coeditor@example.test'),
  ('00000000-0000-0000-0000-0000000000e3', 'other-owner@example.test');
insert into public.pages (id, theme, default_lang, visibility, timezone) values
  ('00000000-0000-0000-0000-0000000000a1', 'a_dreamy', 'en', 'token_only', 'UTC'),
  ('00000000-0000-0000-0000-0000000000a3', 'c_cozy', 'en', 'token_only', 'UTC');
insert into public.memberships (page_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1', 'owner'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e2', 'co_editor'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000e3', 'owner');
-- Sort order is the reverse of the dates, so the date order cannot come from it.
insert into public.items (id, page_id, kind, lang, title, event_date, date_precision, sort_order, lang_alt, title_alt) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'memory', 'en', 'Middle', '2022-06-01', 'month', 1, 'vi', 'Giữa'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'memory', 'en', 'Newest', '2024-05-01', 'day', 2, null, null),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000a1', 'memory', 'en', 'Oldest', '2019-01-01', 'year', 3, null, null),
  ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000a1', 'anniversary', 'en', 'Later', '2021-02-14', 'day', 1, null, null),
  ('00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-0000000000a1', 'milestone', 'en', 'Earlier', '2018-09-01', 'day', 2, null, null),
  ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-0000000000a3', 'memory', 'en', 'Other page', '2024-05-01', 'day', 1, null, null);
-- On b1: a finished photo at position 1, a finished video at position 0, an unfinished photo. b2 has a finished photo.
insert into public.media (id, page_id, item_id, kind, state, position, width, height, alt, alt_alt) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'photo', 'ready', 1, 1600, 1200, 'A beach', 'Bãi biển'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'video', 'ready', 0, 1280, 720, null, null),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'photo', 'uploading', 2, null, null, null, null),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'photo', 'ready', 0, 800, 600, 'Other item', null),
  ('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b9', 'photo', 'ready', 0, 800, 600, 'Other page', null);
insert into public.media_variants (media_id, page_id, variant, bucket, path, mime, bytes, write_until) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'thumb', 'media-thumb', 'p/a1/c1/thumb', 'image/webp', 10, now()),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'display', 'media-display', 'p/a1/c1/display', 'image/webp', 20, now()),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', 'poster', 'media-display', 'p/a1/c2/poster', 'image/webp', 30, now()),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', 'video', 'media-video', 'p/a1/c2/video', 'video/mp4', 40, now()),
  ('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-0000000000a3', 'thumb', 'media-thumb', 'p/a3/c9/thumb', 'image/webp', 10, now());
-- c5 is an upload in progress (a reservation, no variant); c6 was deleted (its file queued, still in the bucket); c7 audio.
insert into public.media (id, page_id, item_id, kind, state, position) values
  ('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'photo', 'uploading', 1),
  ('00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'photo', 'ready', 2),
  ('00000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b3', 'audio', 'ready', 0);
insert into public.upload_reservations (media_id, page_id, files, charged_bytes, write_until) values
  ('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000a1',
    '[{"variant": "thumb", "bucket": "media-thumb", "path": "p/a1/c5/thumb", "max_bytes": 307200}]', 307200, now() + interval '1 hour');
insert into public.media_variants (media_id, page_id, variant, bucket, path, mime, bytes, write_until) values
  ('00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-0000000000a1', 'thumb', 'media-thumb', 'p/a1/c6/thumb', 'image/webp', 10, now()),
  ('00000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-0000000000a1', 'audio', 'media-audio', 'p/a1/c7/audio', 'audio/mp4', 10, now());
delete from public.media where id = '00000000-0000-0000-0000-0000000000c6';
insert into storage.objects (bucket_id, name, metadata) values
  ('media-thumb', 'p/a1/c5/thumb', '{"size": 10}'),
  ('media-thumb', 'p/a1/c6/thumb', '{"size": 10}'),
  ('media-thumb', 'p/a1/c1/thumb', '{"size": 10}'),
  ('media-display', 'p/a1/c2/poster', '{"size": 30}'),
  ('media-thumb', 'p/a3/c9/thumb', '{"size": 10}'),
  ('media-thumb', 'p/a1/stray/thumb', '{"size": 10}');

create function pg_temp.act_as(id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.titles(section public.section_id) returns text[] language sql as $$
  select array_agg(e ->> 'title' order by o) from jsonb_array_elements(public.owner_items_list(titles.section)) with ordinality as t(e, o)
$$;
-- Saves b1 (a memory with Vietnamese as its second language unless lang_alt is null) at version ver with these alts.
create function pg_temp.save_b1(ver int, lang_alt public.lang, alts jsonb) returns jsonb language sql as $$
  select public.owner_item_save('00000000-0000-0000-0000-0000000000b1', save_b1.ver, 'memory', 'en', 'Middle', null,
    save_b1.lang_alt, case when save_b1.lang_alt is null then null else 'Giữa' end, null, date '2022-06-01', 'month',
    false, false, save_b1.alts)
$$;
create function pg_temp.alt_of(id uuid) returns text language sql as $$
  select coalesce(m.alt, '-') || ' | ' || coalesce(m.alt_alt, '-') from public.media m where m.id = alt_of.id
$$;
create function pg_temp.visible(name text) returns bigint language sql as $$
  select count(*) from storage.objects o where o.name = visible.name
$$;
grant execute on function pg_temp.visible(text) to authenticated;

-- O4 order (Q140).
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select is(pg_temp.titles('memories'), array['Newest', 'Middle', 'Oldest'], 'Memories are listed newest first');
select is(pg_temp.titles('together'), array['Earlier', 'Later'], 'Together is listed oldest first, a timeline');

-- O5 read: finished media only, by position, with alt text and the file to preview.
select is(jsonb_path_query_array(public.owner_item_get('00000000-0000-0000-0000-0000000000b1'), '$.media[*].id'),
  '["00000000-0000-0000-0000-0000000000c2", "00000000-0000-0000-0000-0000000000c1"]'::jsonb,
  'the item read lists its finished media by position; an unfinished upload is left out');
select is(public.owner_item_get('00000000-0000-0000-0000-0000000000b1') -> 'media' -> 1,
  '{"id": "00000000-0000-0000-0000-0000000000c1", "kind": "photo", "position": 1, "width": 1600, "height": 1200,
    "duration_ms": null, "alt": "A beach", "alt_alt": "Bãi biển",
    "preview": {"bucket": "media-thumb", "path": "p/a1/c1/thumb"}}'::jsonb,
  'a photo carries its size, its alt text in both languages and its thumbnail to preview');
select is(public.owner_item_get('00000000-0000-0000-0000-0000000000b1') -> 'media' -> 0 -> 'preview',
  '{"bucket": "media-display", "path": "p/a1/c2/poster"}'::jsonb, 'a video previews its poster');
select is(public.owner_item_get('00000000-0000-0000-0000-0000000000b3') -> 'media' -> 0 -> 'preview', 'null'::jsonb,
  'audio has nothing to preview');
select is(public.owner_item_get('00000000-0000-0000-0000-0000000000b4') -> 'media', '[]'::jsonb,
  'an item without media reads an empty list');
select is(public.owner_item_get('00000000-0000-0000-0000-0000000000b9'), null, 'another page''s item is still null (E56)');

-- Alt text is saved with the item, under its version (E15).
select is((pg_temp.save_b1(1, 'vi', '[{"id": "00000000-0000-0000-0000-0000000000c1", "alt": "The beach at dusk", "alt_alt": "Bãi biển lúc hoàng hôn"},
  {"id": "00000000-0000-0000-0000-0000000000c2", "alt": "Waves", "alt_alt": null}]') ->> 'version')::int, 2,
  'a save with alt text moves the item to its next version');
select is(pg_temp.alt_of('00000000-0000-0000-0000-0000000000c1') || ' / ' || pg_temp.alt_of('00000000-0000-0000-0000-0000000000c2'),
  'The beach at dusk | Bãi biển lúc hoàng hôn / Waves | -', 'and stores the alt text of each listed media');
select is(pg_temp.save_b1(1, 'vi', '[{"id": "00000000-0000-0000-0000-0000000000c1", "alt": "Stale", "alt_alt": null}]'), null,
  'a save naming an old version changes nothing');
select is(pg_temp.alt_of('00000000-0000-0000-0000-0000000000c1'), 'The beach at dusk | Bãi biển lúc hoàng hôn',
  'not even the alt text');
select is((pg_temp.save_b1(2, 'vi', '[{"id": "00000000-0000-0000-0000-0000000000c4", "alt": "Not mine", "alt_alt": null},
  {"id": "00000000-0000-0000-0000-0000000000c9", "alt": "Not my page", "alt_alt": null}]') ->> 'version')::int, 3,
  'alt text for media of another item or page does not block the save');
select is(pg_temp.alt_of('00000000-0000-0000-0000-0000000000c4') || ' / ' || pg_temp.alt_of('00000000-0000-0000-0000-0000000000c9'),
  'Other item | - / Other page | -', 'and changes neither of them');
select is((pg_temp.save_b1(3, 'vi', null) ->> 'version')::int, 4, 'a save without alts is accepted');
select is(pg_temp.alt_of('00000000-0000-0000-0000-0000000000c1'), 'The beach at dusk | Bãi biển lúc hoàng hôn',
  'and leaves the alt text as it was');
select is((pg_temp.save_b1(4, 'vi', '[{"id": "00000000-0000-0000-0000-0000000000c1", "alt": "", "alt_alt": ""}]') ->> 'version')::int, 5,
  'empty alt text is accepted');
select is(pg_temp.alt_of('00000000-0000-0000-0000-0000000000c1'), '- | -', 'and stored as no alt text');
select throws_ok($$ select pg_temp.save_b1(5, 'vi', jsonb_build_array(jsonb_build_object('id', '00000000-0000-0000-0000-0000000000c2', 'alt', repeat('a', 301), 'alt_alt', null))) $$,
  '23514', null, 'alt text over 300 characters is refused');
select throws_ok($$ select pg_temp.save_b1(5, 'vi', '{"id": "00000000-0000-0000-0000-0000000000c1"}') $$, '22023', null,
  'alts must be a list');

-- A create carries no media, so alts are not read.
select is(public.owner_item_save('00000000-0000-0000-0000-0000000000b6', null, 'memory', 'en', 'New', null, null, null, null,
  date '2024-01-01', 'day', false, false, '[{"id": "00000000-0000-0000-0000-0000000000c4", "alt": "Hijack", "alt_alt": null}]') ->> 'version', '1',
  'a create with alts saves the new item');
select is(pg_temp.alt_of('00000000-0000-0000-0000-0000000000c4'), 'Other item | -', 'and changes no media');

-- Removing the second language drops its alt text (owner UI O5, removeSecondHint).
select pg_temp.save_b1(5, 'vi', '[{"id": "00000000-0000-0000-0000-0000000000c1", "alt": "Beach", "alt_alt": "Biển"}]');
select is((pg_temp.save_b1(6, null, '[{"id": "00000000-0000-0000-0000-0000000000c1", "alt": "Beach", "alt_alt": "Biển"}]') ->> 'version')::int, 7,
  'the second language can be removed in a save that still sends its alt text');
select is(pg_temp.alt_of('00000000-0000-0000-0000-0000000000c1'), 'Beach | -', 'its alt text is dropped, the main one kept');
update public.media set alt_alt = 'Biển' where id = '00000000-0000-0000-0000-0000000000c1';
select pg_temp.save_b1(7, null, null);
select is(pg_temp.alt_of('00000000-0000-0000-0000-0000000000c1'), 'Beach | -', 'also when the save sends no alts');

-- The owner may read the files of their own page's media, so the route can sign preview URLs (design 3 §3.4).
select ok(has_function_privilege('authenticated', 'public.owner_media_readable(text, text)', 'execute')
  and not has_function_privilege('anon', 'public.owner_media_readable(text, text)', 'execute'),
  'authenticated can call owner_media_readable; anon cannot');
set local role authenticated;
select is(pg_temp.visible('p/a1/c1/thumb') + pg_temp.visible('p/a1/c2/poster'), 2::bigint, 'the owner sees their media files');
select is(pg_temp.visible('p/a3/c9/thumb') + pg_temp.visible('p/a1/stray/thumb'), 0::bigint,
  'but not another page''s, nor a file no media of theirs names');
select is(pg_temp.visible('p/a1/c6/thumb'), 0::bigint, 'nor the file of deleted media still waiting for the worker');
select is(pg_temp.visible('p/a1/c5/thumb'), 1::bigint,
  'but a file of their own upload in progress, so Complete can check its bytes (security gate, Phase 2)');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e2');
set local role authenticated;
select is(pg_temp.visible('p/a1/c1/thumb'), 0::bigint, 'a co-editor sees none (owner functions are owner-only for now)');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e3');
set local role authenticated;
select is(pg_temp.visible('p/a3/c9/thumb') + pg_temp.visible('p/a1/c1/thumb'), 1::bigint, 'the other owner sees only their own');
reset role;

select * from finish();
rollback;
