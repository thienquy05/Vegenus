-- Daily reconcile (T2.3c; design 3 §3.4 "Reconcile"): an object in a media bucket that no variant, live reservation or
-- pending deletion accounts for is queued for deletion at its real size, so it is charged until it is confirmed gone.
-- It also corrects a finished file whose real size differs from the recorded one (a security review of T2.3a: a
-- still-valid upload URL must not let a larger file go uncharged). Only vegenus_server calls it (the daily cron route,
-- Q134). Uploads are simulated by inserting storage.objects rows.
-- Placeholder data only.
begin;
select plan(12);

insert into public.pages (id, theme, default_lang, timezone) values ('00000000-0000-0000-0000-0000000000a1', 'a_dreamy', 'en', 'UTC');
insert into public.items (id, page_id, kind, lang, title, event_date, date_precision) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'memory', 'en', 'Memory', '2024-05-01', 'day');
insert into public.media (id, page_id, item_id, kind, state) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'photo', 'ready'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'photo', 'uploading');
-- p1 is a finished file, p2 an upload in progress, p3 queued for deletion, p5 deleted once and then written again.
insert into public.media_variants (media_id, page_id, variant, bucket, path, mime, bytes, write_until) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'thumb', 'media-thumb',
    'pages/00000000-0000-0000-0000-0000000000a1/media/p1/thumb', 'image/webp', 10, now());
insert into public.upload_reservations (media_id, page_id, files, charged_bytes, write_until) values
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1',
    '[{"variant": "thumb", "bucket": "media-thumb", "path": "pages/00000000-0000-0000-0000-0000000000a1/media/p2/thumb", "max_bytes": 307200}]',
    307200, now() + interval '1 hour');
insert into public.storage_deletions (page_id, bucket, path, bytes, done_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'media-thumb', 'pages/00000000-0000-0000-0000-0000000000a1/media/p3/thumb', 30, null),
  ('00000000-0000-0000-0000-0000000000a1', 'media-thumb', 'pages/00000000-0000-0000-0000-0000000000a1/media/p5/thumb', 50, now());
insert into storage.buckets (id, name) values ('not-media', 'not-media');
insert into storage.objects (bucket_id, name, metadata) values
  ('media-thumb', 'pages/00000000-0000-0000-0000-0000000000a1/media/p1/thumb', '{"size": 15}'),
  ('media-thumb', 'pages/00000000-0000-0000-0000-0000000000a1/media/p2/thumb', '{"size": 20}'),
  ('media-thumb', 'pages/00000000-0000-0000-0000-0000000000a1/media/p3/thumb', '{"size": 30}'),
  ('media-thumb', 'pages/00000000-0000-0000-0000-0000000000a1/media/p4/thumb', '{"size": 40}'),
  ('media-thumb', 'pages/00000000-0000-0000-0000-0000000000a1/media/p5/thumb', '{"size": 50}'),
  ('media-display', 'stray/file', '{"size": 60}'),
  ('not-media', 'pages/00000000-0000-0000-0000-0000000000a1/media/p6/thumb', '{"size": 70}');

select ok(has_function_privilege('vegenus_server', 'public.worker_reconcile()', 'execute')
  and not has_function_privilege('authenticated', 'public.worker_reconcile()', 'execute')
  and not has_function_privilege('anon', 'public.worker_reconcile()', 'execute'), 'only vegenus_server can reconcile');

select is(public.worker_reconcile(), jsonb_build_object('orphans', 3, 'resized', 1),
  'reconcile queues the three unaccounted media objects and corrects one recorded size');
select is((select v.bytes from public.media_variants v where v.path like '%/p1/thumb'), 15::bigint,
  'the finished file is charged at its real size');
select is((select array_agg(d.path || ' ' || d.bytes order by d.path) from public.storage_deletions d where d.done_at is null and d.path <> 'pages/00000000-0000-0000-0000-0000000000a1/media/p3/thumb'),
  array['pages/00000000-0000-0000-0000-0000000000a1/media/p4/thumb 40', 'pages/00000000-0000-0000-0000-0000000000a1/media/p5/thumb 50', 'stray/file 60'],
  'each at its real size: a file that was written again after its deletion counts too');
select is((select d.page_id from public.storage_deletions d where d.path like '%/p4/thumb'), '00000000-0000-0000-0000-0000000000a1'::uuid,
  'the page is read from the path, so the bytes are charged to it');
select ok((select bool_and(d.not_before <= now()) from public.storage_deletions d where d.path in ('stray/file') or d.path like '%/p4/thumb'),
  'orphans are due at once: no live upload URL can write them');
select is(public.storage_used('00000000-0000-0000-0000-0000000000a1'), (15 + 307200 + 30 + 40 + 50)::bigint,
  'used counts the finished file, the reservation, the queued file and both orphans of the page');
select is(public.worker_reconcile(), jsonb_build_object('orphans', 0, 'resized', 0), 'a second run finds nothing new');

-- A deletion whose file is still there counts an attempt, and the least-tried rows come first, so files that keep
-- failing cannot starve newer ones (Codex T2.3c).
insert into public.storage_deletions (page_id, bucket, path, bytes, not_before) values
  ('00000000-0000-0000-0000-0000000000a1', 'media-thumb', 'stuck/thumb', 1, now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000a1', 'media-thumb', 'fresh/thumb', 1, now() - interval '1 minute');
insert into storage.objects (bucket_id, name, metadata) values ('media-thumb', 'stuck/thumb', '{"size": 1}');
select is(public.worker_deletion_done((select d.id from public.storage_deletions d where d.path = 'stuck/thumb')), false,
  'a deletion whose file is still there is not done');
select is((select d.attempts from public.storage_deletions d where d.path = 'stuck/thumb'), 1, 'and counts one attempt');
select is((select d.attempts from public.storage_deletions d where d.path = 'fresh/thumb'), 0, 'other rows keep theirs');
select is((select array_agg(x.path order by x.n) from (select d.path, row_number() over () as n from public.worker_due_deletions(100) d) x
  where x.path in ('stuck/thumb', 'fresh/thumb')), array['fresh/thumb', 'stuck/thumb'],
  'the worker gets the untried row before the one that failed, although it is newer');

select * from finish();
rollback;
