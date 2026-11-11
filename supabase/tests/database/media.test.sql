-- Media upload admission, charging and deletion (T2.3a; design 3 §3.4; PRD E9, E10, E16, E56; Q133-Q135).
-- owner_upload_begin reserves the class limit of every admitted file under the page row lock; Complete reads the
-- real sizes from storage.objects; Cancel, expiry and a refused Complete move the charge to storage_deletions,
-- fenced until write_until + 15 minutes; deleting finished media (directly or through a cascade) moves the real
-- bytes there; the worker frees a charge only once the object is gone. Uploads are simulated by inserting
-- storage.objects rows as the storage service would. Placeholder data only.
begin;
select plan(53);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000e2', 'coeditor@example.test'),
  ('00000000-0000-0000-0000-0000000000e3', 'other-owner@example.test');
insert into public.pages (id, theme, default_lang, timezone) values
  ('00000000-0000-0000-0000-0000000000a1', 'a_dreamy', 'en', 'UTC'),
  ('00000000-0000-0000-0000-0000000000a3', 'c_cozy', 'en', 'UTC');
insert into public.memberships (page_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1', 'owner'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e2', 'co_editor'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000e3', 'owner');
insert into public.items (id, page_id, kind, lang, title, event_date, date_precision) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'memory', 'en', 'Memory', '2024-05-01', 'day'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'memory', 'en', 'Second', '2024-05-01', 'day'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000a3', 'memory', 'en', 'Other page', '2024-05-01', 'day');

create function pg_temp.act_as(id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
$$;
-- Uploads begun in this test, by name; readable by the roles the test switches to.
create temp table up (name text primary key, v jsonb);
grant select on up to authenticated;
create function pg_temp.media(name text) returns uuid language sql as $$ select (u.v ->> 'media_id')::uuid from up u where u.name = media.name $$;
-- The storage service writing one admitted file of an upload with the given size.
create function pg_temp.land(name text, variant text, bytes bigint) returns void language sql as $$
  insert into storage.objects (bucket_id, name, metadata)
  select f ->> 'bucket', f ->> 'path', jsonb_build_object('size', land.bytes, 'mimetype', 'image/webp')
  from up u, jsonb_array_elements(u.v -> 'files') f where u.name = land.name and f ->> 'variant' = land.variant
$$;
create function pg_temp.used() returns bigint language sql as $$
  select public.storage_used('00000000-0000-0000-0000-0000000000a1')
$$;
create temp table snap (used bigint);
-- Class limits (design 3 §3.4): thumb 300 KiB, display and poster 2 MiB, full 8 MiB, audio 10 MiB, video 50 MiB.
create function pg_temp.photo_charge() returns bigint language sql as $$ select (300 * 1024 + 2 * 1048576)::bigint $$;

-- Who may call them.
select throws_ok($$ set local role anon; select public.owner_upload_begin('00000000-0000-0000-0000-0000000000b1', 'photo', '{thumb,display}') $$,
  '42501', null, 'anon cannot begin an upload');
reset role;
select ok(has_function_privilege('authenticated', 'public.owner_upload_begin(uuid, public.media_kind, public.media_variant[])', 'execute')
  and not has_function_privilege('authenticated', 'public.worker_deletion_done(bigint)', 'execute')
  and has_function_privilege('vegenus_server', 'public.worker_deletion_done(bigint)', 'execute')
  and not has_function_privilege('vegenus_server', 'public.owner_upload_begin(uuid, public.media_kind, public.media_variant[])', 'execute'),
  'owners call the owner functions; only vegenus_server calls the worker functions');
select is((select array_agg(b.id || ' ' || b.file_size_limit || ' ' || b.public order by b.id) from storage.buckets b where b.id like 'media-%'),
  array['media-audio 10485760 false', 'media-display 2097152 false', 'media-full 8388608 false', 'media-thumb 307200 false', 'media-video 52428800 false'],
  'one private bucket per size class, each limited to its class (verified: Supabase rejects larger uploads)');

-- Begin reserves the class limits under the page lock (E10).
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select is(pg_temp.used(), 0::bigint, 'a new page uses nothing');
insert into up values ('a', public.owner_upload_begin('00000000-0000-0000-0000-0000000000b1', 'photo', '{thumb,display}'));
select is((select jsonb_array_length(v -> 'files') from up where name = 'a'), 2, 'begin admits one file per variant');
select is((select f ->> 'path' from up, jsonb_array_elements(v -> 'files') f where name = 'a' and f ->> 'variant' = 'display'),
  'pages/00000000-0000-0000-0000-0000000000a1/media/' || pg_temp.media('a') || '/display',
  'the path is made of random ids only, never a file name');
select is((select f ->> 'bucket' from up, jsonb_array_elements(v -> 'files') f where name = 'a' and f ->> 'variant' = 'thumb'),
  'media-thumb', 'each file goes to its class bucket');
select ok((select (v ->> 'write_until')::timestamptz between now() + interval '124 minutes' and now() + interval '126 minutes' from up where name = 'a'),
  'the write window is 2 hours plus 5 minutes, so 2-hour upload URLs minted right after Begin expire before it (Q135)');
select is((select m.state::text || ' ' || m.item_id from public.media m where m.id = pg_temp.media('a')),
  'uploading 00000000-0000-0000-0000-0000000000b1', 'the media row is uploading, on its item');
select is(pg_temp.used(), pg_temp.photo_charge(), 'the reservation charges the class limits of the admitted files');

select throws_ok($$ select public.owner_upload_begin('00000000-0000-0000-0000-0000000000b1', 'photo', '{video}') $$,
  '22023', null, 'a photo cannot carry a video file');
select throws_ok($$ select public.owner_upload_begin('00000000-0000-0000-0000-0000000000b1', 'photo', '{thumb}') $$,
  '22023', null, 'a photo needs its display file');
select throws_ok($$ select public.owner_upload_begin('00000000-0000-0000-0000-0000000000b1', 'video', '{poster}') $$,
  '22023', null, 'a video needs its clip');
select is(public.owner_upload_begin('00000000-0000-0000-0000-0000000000b3', 'photo', '{thumb,display}'), null,
  'an item of another page answers null (E56)');
select is(public.owner_upload_begin(gen_random_uuid(), 'photo', '{thumb,display}'), null, 'a missing item answers the same');

-- The budget counts reservations, so two uploads that start together cannot both pass (E10).
update public.pages set storage_budget_bytes = pg_temp.photo_charge() * 2 + 10 where id = '00000000-0000-0000-0000-0000000000a1';
insert into up values ('b', public.owner_upload_begin('00000000-0000-0000-0000-0000000000b1', 'photo', '{thumb,display}'));
select throws_ok($$ select public.owner_upload_begin('00000000-0000-0000-0000-0000000000b1', 'photo', '{thumb,display}') $$,
  '53400', null, 'an upload that would pass the budget, counting reserved space, is refused');
update public.pages set storage_budget_bytes = 943718400 where id = '00000000-0000-0000-0000-0000000000a1';

-- The storage insert policy: only an admitted path of the caller's page, before write_until, once.
set local role authenticated;
select lives_ok($$ insert into storage.objects (bucket_id, name, metadata)
    select f ->> 'bucket', f ->> 'path', '{"size": 1000, "mimetype": "image/webp"}' from up, jsonb_array_elements(v -> 'files') f
    where name = 'a' and f ->> 'variant' = 'thumb' $$, 'the owner can write an admitted path');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('media-thumb', 'pages/00000000-0000-0000-0000-0000000000a1/media/x/thumb') $$,
  '42501', null, 'a path that no reservation admits is refused');
select throws_ok($$ insert into storage.objects (bucket_id, name)
    select f ->> 'bucket', f ->> 'path' from up, jsonb_array_elements(v -> 'files') f where name = 'a' and f ->> 'variant' = 'thumb' $$,
  '23505', null, 'an admitted path is written once: no overwrite');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e3');
set local role authenticated;
select throws_ok($$ insert into storage.objects (bucket_id, name)
    select f ->> 'bucket', f ->> 'path' from up, jsonb_array_elements(v -> 'files') f where name = 'b' and f ->> 'variant' = 'thumb' $$,
  '42501', null, 'another owner cannot write this page''s admitted path');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');

-- Complete reads the real sizes; it never trusts the browser.
select is(public.owner_upload_complete(pg_temp.media('a'), 1600, 1200, null), 'incomplete',
  'a Complete with a file still missing answers incomplete and changes nothing');
select pg_temp.land('a', 'display', 250000);
select is(public.owner_upload_complete(pg_temp.media('a'), 1600, 1200, null), 'ready',
  'a Complete with every file within its class answers ready');
select is((select m.state::text || ' ' || m.width || 'x' || m.height from public.media m where m.id = pg_temp.media('a')),
  'ready 1600x1200', 'the media is ready with its dimensions');
select is((select array_agg(mv.variant::text || ' ' || mv.bytes order by mv.variant) from public.media_variants mv
  where mv.media_id = pg_temp.media('a')), array['thumb 1000', 'display 250000'], 'the variants record the real sizes');
select is(pg_temp.used(), 251000 + pg_temp.photo_charge(), 'the charge moved from the reservation to the real sizes');
select is(public.owner_upload_complete(pg_temp.media('a'), 1600, 1200, null), null, 'a second Complete answers null: no reservation');

-- A file over its admitted size is refused and its charge stays until it is deleted.
select pg_temp.land('b', 'thumb', 307201);
select pg_temp.land('b', 'display', 1000);
select is(public.owner_upload_complete(pg_temp.media('b'), 10, 10, null), 'too_large', 'a Complete with a file over its class answers too_large');
select is((select m.state::text from public.media m where m.id = pg_temp.media('b')), 'failed', 'the media is marked failed');
select is((select count(*) from public.storage_deletions d where d.path like '%' || pg_temp.media('b') || '%'
  and d.not_before = (select (v ->> 'write_until')::timestamptz from up where name = 'b') + interval '15 minutes'), 2::bigint,
  'both admitted paths are queued for deletion, fenced until write_until + 15 minutes (Q135)');
select is(pg_temp.used(), 251000 + pg_temp.photo_charge(), 'and stay charged at the reserved amount');

-- Cancel and expiry move the charge the same way (E9).
insert into up values ('c', public.owner_upload_begin('00000000-0000-0000-0000-0000000000b2', 'photo', '{thumb,display}'));
select is(public.owner_upload_cancel(pg_temp.media('c')), true, 'cancel answers true');
select is(public.owner_upload_cancel(pg_temp.media('c')), false, 'a second cancel answers false');
select is((select m.state::text from public.media m where m.id = pg_temp.media('c')), 'failed', 'the cancelled media is failed');
select is(pg_temp.used(), 251000 + pg_temp.photo_charge() * 2, 'the cancelled upload stays charged until its files are confirmed gone');
insert into up values ('d', public.owner_upload_begin('00000000-0000-0000-0000-0000000000b2', 'photo', '{thumb,display}'));
update public.upload_reservations set write_until = now() - interval '1 minute' where media_id = pg_temp.media('d');
select is(public.owner_upload_complete(pg_temp.media('d'), 1, 1, null), null, 'a Complete after write_until answers null');
insert into up values ('e', public.owner_upload_begin('00000000-0000-0000-0000-0000000000b2', 'photo', '{thumb,display}'));
select is((select count(*) from public.upload_reservations r where r.media_id = pg_temp.media('d')), 0::bigint,
  'the next Begin expires the overdue reservation');
select is((select m.state::text from public.media m where m.id = pg_temp.media('d')), 'failed', 'and marks its media failed');
update public.upload_reservations set write_until = now() - interval '1 minute' where media_id = pg_temp.media('e');
select is(public.worker_expire_uploads(), 1, 'the daily job expires overdue reservations of every page');
reset role;

-- Deleting finished media keeps its bytes charged until the files are gone, also through a cascade (E16).
select is(public.owner_media_delete(pg_temp.media('a')), true, 'the owner deletes ready media');
select is((select array_agg(d.bytes order by d.bytes) from public.storage_deletions d
  where d.path like '%' || pg_temp.media('a') || '%'
    and d.not_before = (select (v ->> 'write_until')::timestamptz from up where name = 'a') + interval '15 minutes'),
  array[1000, 250000]::bigint[],
  'its files are queued at their real sizes, fenced until its upload URLs are dead: a URL still valid could write the path again (Codex T2.3a)');
select is(public.owner_media_delete(pg_temp.media('a')), false, 'a second delete answers false');
insert into up values ('f', public.owner_upload_begin('00000000-0000-0000-0000-0000000000b2', 'photo', '{thumb,display}'));
insert into snap select pg_temp.used();
delete from public.items where id = '00000000-0000-0000-0000-0000000000b2';
select is(pg_temp.used(), (select used from snap), 'deleting an item with an upload in flight keeps every byte charged');
select is((select count(*) from public.media m where m.item_id = '00000000-0000-0000-0000-0000000000b2'), 0::bigint, 'and removes its media');

-- Another owner and a co-editor (E6, E33, E56).
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e3');
select is(public.owner_media_delete(pg_temp.media('b')), false, 'another owner cannot delete this page''s media');
select is(public.owner_upload_cancel(pg_temp.media('e')), false, 'or cancel its uploads');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e2');
select throws_ok($$ select public.owner_upload_begin('00000000-0000-0000-0000-0000000000b1', 'photo', '{thumb,display}') $$,
  '42501', null, 'a co-editor cannot upload (E33)');

-- The worker frees a charge only once the object is gone. (The test calls the worker functions as its own user; who may
-- call them is checked at the top.)
create temp table display_a as select d.id from public.storage_deletions d where d.path like '%' || pg_temp.media('a') || '/display';
-- (Time passes: the fence of media a is over.)
update public.storage_deletions set not_before = now() - interval '1 minute' where id = (select id from display_a);
select ok(not exists (select 1 from public.worker_due_deletions(100) d where d.not_before > now()),
  'the worker is never handed a deletion before its fence');
select ok(exists (select 1 from public.worker_due_deletions(100) d where d.id = (select id from display_a)), 'it is handed the deletions that are due');
select is(public.worker_deletion_done((select id from display_a)), false, 'a deletion is not marked done while the object still exists');
reset role;
-- The Storage API deleting the object (the storage schema refuses a direct delete unless this is set).
set local storage.allow_delete_query = 'true';
delete from storage.objects where name like '%' || pg_temp.media('a') || '/display';
truncate snap;
insert into snap select pg_temp.used();
select is(public.worker_deletion_done((select id from display_a)), true, 'once the object is gone the deletion is done');
reset role;
select is(pg_temp.used(), (select used from snap) - 250000, 'and only then is its space free');

-- A failed media row leaves once none of its files is pending deletion (E9).
-- (Its fence has passed: the cancelled upload's write window and drain are over.)
update public.storage_deletions set not_before = now() - interval '1 minute' where path like '%' || pg_temp.media('c') || '%';
create temp table pending_c as select d.id from public.storage_deletions d where d.path like '%' || pg_temp.media('c') || '%';
select public.worker_deletion_done(id) from pending_c;
reset role;
select is((select count(*) from public.media m where m.id = pg_temp.media('c')), 0::bigint,
  'the cancelled media row is removed once its files are confirmed gone');

-- Deleting a page keeps its pending deletions, so its files are still removed.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
insert into up values ('g', public.owner_upload_begin('00000000-0000-0000-0000-0000000000b1', 'photo', '{thumb,display}'));
delete from public.pages where id = '00000000-0000-0000-0000-0000000000a1';
select is((select count(*) from public.storage_deletions d where d.page_id = '00000000-0000-0000-0000-0000000000a1'
  and d.path like '%' || pg_temp.media('g') || '%' and d.done_at is null), 2::bigint,
  'pending deletions outlive their page, including the uploads it still held');

select * from finish();
rollback;
