-- Security gate, Phase 2 (Codex review): before Complete, the upload route reads every stored file and checks its
-- bytes. owner_upload_files lists the files of the caller's live reservation (with the type storage recorded and
-- whether each is written yet), and the owner may read those files while the upload is pending; no one else may, and
-- nothing once the reservation is gone. Placeholder data only.
begin;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000002e1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000002e3', 'other-owner@example.test');
insert into public.pages (id, theme, default_lang, timezone) values
  ('00000000-0000-0000-0000-0000000002a1', null, 'en', 'UTC'), ('00000000-0000-0000-0000-0000000002a3', null, 'en', 'UTC');
insert into public.memberships (page_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000002a1', '00000000-0000-0000-0000-0000000002e1', 'owner'),
  ('00000000-0000-0000-0000-0000000002a3', '00000000-0000-0000-0000-0000000002e3', 'owner');
insert into public.items (id, page_id, kind, lang, title, event_date, date_precision) values
  ('00000000-0000-0000-0000-0000000002b1', '00000000-0000-0000-0000-0000000002a1', 'memory', 'en', 'Memory', '2024-05-01', 'day');

create function pg_temp.act_as(id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
$$;
create temp table up (v jsonb);
select pg_temp.act_as('00000000-0000-0000-0000-0000000002e1');
insert into up select public.owner_upload_begin('00000000-0000-0000-0000-0000000002b1', 'photo', '{thumb,display}');
create function pg_temp.m() returns uuid language sql as $$ select (v ->> 'media_id')::uuid from up $$;
create function pg_temp.thumb() returns jsonb language sql as $$
  select f from up, jsonb_array_elements(v -> 'files') f where f ->> 'variant' = 'thumb'
$$;

select is((select jsonb_agg(f ->> 'present' order by f ->> 'path') from jsonb_array_elements(public.owner_upload_files(pg_temp.m())) f),
  '["false", "false"]'::jsonb, 'the owner sees both files of the pending upload, neither written yet');
insert into storage.objects (bucket_id, name, metadata)
  select t ->> 'bucket', t ->> 'path', '{"size": 1000, "mimetype": "image/webp"}' from (select pg_temp.thumb() t) x;
select is((select f - 'path' from jsonb_array_elements(public.owner_upload_files(pg_temp.m())) f where f ->> 'path' like '%/thumb'),
  '{"bucket": "media-thumb", "mime": "image/webp", "present": true}'::jsonb, 'a written file shows its bucket and the type storage recorded');
select ok(public.owner_media_readable('media-thumb', pg_temp.thumb() ->> 'path'), 'the owner may read a file of their pending upload');

select pg_temp.act_as('00000000-0000-0000-0000-0000000002e3');
select is(public.owner_upload_files(pg_temp.m()), null, 'another owner gets nothing');
select ok(not public.owner_media_readable('media-thumb', pg_temp.thumb() ->> 'path'), 'another owner may not read it');
select is(public.owner_upload_files('00000000-0000-0000-0000-0000000002ff'), null, 'an unknown upload gives nothing');

select pg_temp.act_as('00000000-0000-0000-0000-0000000002e1');
update public.upload_reservations set write_until = now() - interval '1 second' where media_id = pg_temp.m();
select ok(public.owner_upload_files(pg_temp.m()) is null and not public.owner_media_readable('media-thumb', pg_temp.thumb() ->> 'path'),
  'a reservation past write_until is neither listed nor readable, though not yet removed');
update public.upload_reservations set write_until = now() + interval '1 hour' where media_id = pg_temp.m();
select ok(public.owner_upload_cancel(pg_temp.m()), 'the owner cancels the upload');
select ok(public.owner_upload_files(pg_temp.m()) is null and not public.owner_media_readable('media-thumb', pg_temp.thumb() ->> 'path'),
  'once the reservation is gone, its files are neither listed nor readable');

reset role;
select ok(has_function_privilege('authenticated', 'public.owner_upload_files(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.owner_upload_files(uuid)', 'execute'), 'owners call it; guests cannot');

select * from finish();
rollback;
