-- Security gate, Phase 2 (Codex re-review; Q141 point 3): Complete checks the type storage recorded for each file
-- against its bucket's list of allowed types, so no file of another type reaches ready. A mismatch fails the media
-- and queues its files for deletion, like a file over its size. Placeholder data only.
begin;
select plan(6);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000003e1', 'owner@example.test');
insert into public.pages (id, theme, default_lang, timezone) values ('00000000-0000-0000-0000-0000000003a1', null, 'en', 'UTC');
insert into public.memberships (page_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-0000000003e1', 'owner');
insert into public.items (id, page_id, kind, lang, title, event_date, date_precision) values
  ('00000000-0000-0000-0000-0000000003b1', '00000000-0000-0000-0000-0000000003a1', 'memory', 'en', 'Memory', '2024-05-01', 'day');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000003e1", "role": "authenticated"}', true);
create temp table up (name text, v jsonb);
insert into up values
  ('bad', public.owner_upload_begin('00000000-0000-0000-0000-0000000003b1', 'photo', '{thumb,display}')),
  ('good', public.owner_upload_begin('00000000-0000-0000-0000-0000000003b1', 'photo', '{thumb,display}'));
create function pg_temp.m(name text) returns uuid language sql as $$ select (v ->> 'media_id')::uuid from up where up.name = m.name $$;
-- Lands each file of an upload with the given type for its thumb and image/webp for the rest.
create function pg_temp.land(name text, thumb_mime text) returns void language sql as $$
  insert into storage.objects (bucket_id, name, metadata)
  select f ->> 'bucket', f ->> 'path', jsonb_build_object('size', 1000,
    'mimetype', case f ->> 'variant' when 'thumb' then land.thumb_mime else 'image/webp' end)
  from up u, jsonb_array_elements(u.v -> 'files') f where u.name = land.name
$$;

insert into storage.objects (bucket_id, name, metadata)
  select f ->> 'bucket', f ->> 'path', '{"size": 1000, "mimetype": "image/jpeg"}'
  from up, jsonb_array_elements(v -> 'files') f where up.name = 'good' and f ->> 'variant' = 'thumb';
select is(public.owner_upload_complete(pg_temp.m('good'), 10, 10, null), 'incomplete', 'a file not written yet is incomplete, not a wrong type');

select pg_temp.land('bad', 'video/mp4'); -- a type another bucket allows, not the thumb bucket
select is(public.owner_upload_complete(pg_temp.m('bad'), 10, 10, null), 'invalid_file',
  'a file whose recorded type its bucket does not allow answers invalid_file');
select is((select m.state::text from public.media m where m.id = pg_temp.m('bad')), 'failed', 'the media is marked failed');
select is((select count(*) from public.media_variants v where v.media_id = pg_temp.m('bad')), 0::bigint, 'no variant is recorded');
select is((select count(*) from public.storage_deletions d where d.media_id = pg_temp.m('bad')), 2::bigint,
  'both files are queued for deletion');

insert into storage.objects (bucket_id, name, metadata)
  select f ->> 'bucket', f ->> 'path', '{"size": 1000, "mimetype": "image/webp"}'
  from up, jsonb_array_elements(v -> 'files') f where up.name = 'good' and f ->> 'variant' = 'display';
select is(public.owner_upload_complete(pg_temp.m('good'), 10, 10, null), 'ready', 'types the buckets allow still complete');

select * from finish();
rollback;
