-- Daily job record, health and the owner usage read (T2.5a; PRD Q145; design 3 §3.9 `job_runs`; owner UI "O10 Usage";
-- E23). The daily cron records each run (no personal data) and keeps 30 days (Q45). A run is a success only when it
-- answered 200 with no failed deletion; health is a success in the last 26 hours (Q145 5, 12). owner_usage is the one
-- snapshot O2 and O10 read (Q145 13). Placeholder data only.
begin;
select plan(26);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000e2', 'coeditor@example.test'),
  ('00000000-0000-0000-0000-0000000000e3', 'nobody@example.test'),
  ('00000000-0000-0000-0000-0000000000e4', 'other@example.test');
insert into public.pages (id, theme, default_lang, timezone, created_at, storage_budget_bytes) values
  ('00000000-0000-0000-0000-0000000000a1', 'a_dreamy', 'en', 'Asia/Ho_Chi_Minh', '2026-01-02 03:04:05+00', 1000),
  ('00000000-0000-0000-0000-0000000000a2', 'c_cozy', 'en', 'UTC', now(), 900);
insert into public.memberships (page_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1', 'owner'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e2', 'co_editor'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000e4', 'owner');
insert into public.items (id, page_id, kind, lang, title, event_date, date_precision) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'memory', 'en', 'Memory', '2024-05-01', 'day'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2', 'memory', 'en', 'Memory', '2024-05-01', 'day');
insert into public.media (id, page_id, item_id, kind, state) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'photo', 'ready'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'photo', 'uploading'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b2', 'photo', 'uploading');
-- Page a2 (another owner) holds 500 in an upload and 60 waiting: never counted for a1 (E56).
-- Page a1 holds 10 stored bytes, 300 in an upload and 40 waiting to be deleted (one deletion already done does not count).
insert into public.media_variants (media_id, page_id, variant, bucket, path, mime, bytes, write_until) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'thumb', 'media-thumb', 'p/a1/c1/thumb', 'image/webp', 10, now());
insert into public.upload_reservations (media_id, page_id, files, charged_bytes, write_until) values
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', '[]', 300, now() + interval '1 hour'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a2', '[]', 500, now() + interval '1 hour');
insert into public.storage_deletions (page_id, bucket, path, bytes, done_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'media-thumb', 'p/a1/gone/thumb', 40, null),
  ('00000000-0000-0000-0000-0000000000a1', 'media-thumb', 'p/a1/done/thumb', 70, now()),
  ('00000000-0000-0000-0000-0000000000a2', 'media-thumb', 'p/a2/gone/thumb', 60, null);

create function pg_temp.act_as(id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.usage() returns jsonb language sql as $$ select public.owner_usage() $$;

-- Privileges (design 3 §5: deny by default).
select ok(has_function_privilege('vegenus_server', 'public.worker_job_record(timestamptz, text, int, int, int, int, int)', 'execute')
  and not has_function_privilege('authenticated', 'public.worker_job_record(timestamptz, text, int, int, int, int, int)', 'execute')
  and not has_function_privilege('anon', 'public.worker_job_record(timestamptz, text, int, int, int, int, int)', 'execute'),
  'only vegenus_server records a run');
select ok(has_function_privilege('vegenus_server', 'public.health_ok()', 'execute')
  and not has_function_privilege('authenticated', 'public.health_ok()', 'execute')
  and not has_function_privilege('anon', 'public.health_ok()', 'execute'),
  'only vegenus_server reads health (the public route reads it through the server connection)');
select ok(has_function_privilege('authenticated', 'public.owner_usage()', 'execute')
  and not has_function_privilege('anon', 'public.owner_usage()', 'execute')
  and not has_function_privilege('vegenus_server', 'public.owner_usage()', 'execute'),
  'only a signed-in caller reads usage');
select columns_are('public', 'job_runs', array['id', 'job', 'started_at', 'finished_at', 'result', 'expired', 'orphans', 'resized', 'deleted', 'failed'],
  'job_runs holds times, the result and counts only: no personal data');

-- Before any run (an e2e run of the cron leaves rows in a local database; this transaction rolls back).
delete from public.job_runs;
select is(public.health_ok(), false, 'no run recorded: not healthy');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select is(pg_temp.usage() - 'read_at', jsonb_build_object(
    'total_bytes', 350, 'budget_bytes', 1000, 'uploading_bytes', 300, 'deleting_bytes', 40,
    'page_created_at', '2026-01-02T03:04:05+00:00', 'timezone', 'Asia/Ho_Chi_Minh',
    'last_attempt_at', null, 'last_attempt_result', null, 'last_success_at', null,
    'last_success_corrections', 0, 'has_run', false),
  'the owner reads the snapshot: storage parts, the page creation time and time zone, no run yet');
select is((pg_temp.usage() ->> 'read_at')::timestamptz, now(), 'read_at is the server''s clock');
select is((pg_temp.usage() ->> 'total_bytes')::bigint, public.storage_used('00000000-0000-0000-0000-0000000000a1'),
  'the total is the charged total the budget check uses');

-- Recording runs.
select lives_ok($$select public.worker_job_record(now() - interval '2 minutes', '200', 1, 2, 3, 4, 0)$$, 'a successful run is recorded');
select is((select array[r.expired, r.orphans, r.resized, r.deleted, r.failed] from public.job_runs r),
  array[1, 2, 3, 4, 0], 'with its counts');
select is((select r.finished_at from public.job_runs r), now(), 'finished at the server''s clock');
select is(public.health_ok(), true, 'a success in the last 26 hours: healthy');
select is(pg_temp.usage() - 'read_at' - 'total_bytes' - 'budget_bytes' - 'uploading_bytes' - 'deleting_bytes' - 'page_created_at' - 'timezone',
  jsonb_build_object('last_attempt_at', to_jsonb(now()), 'last_attempt_result', '200', 'last_success_at', to_jsonb(now()),
    'last_success_corrections', 5, 'has_run', true),
  'the snapshot names the last attempt and success; corrections are orphans plus resized');
select throws_ok($$select public.worker_job_record(now(), 'ok', 0, 0, 0, 0, 0)$$, '23514', null, 'an unknown result is refused');
select throws_ok($$select public.worker_job_record(now(), '200', -1, 0, 0, 0, 0)$$, '23514', null, 'a negative count is refused');
-- The start comes from the app's clock: one ahead of the database's is clamped, so a good run is never lost to it.
select public.worker_job_record(now() + interval '1 minute', '200', 0, 0, 0, 0, 0);
select is((select r.started_at from public.job_runs r order by r.id desc limit 1), now(), 'a start ahead of the database clock is clamped');

-- The 26-hour rule (Q145 5, 12): only a 200 without failed deletions counts, measured from the last success.
delete from public.job_runs;
insert into public.job_runs (started_at, finished_at, result) values (now() - interval '26 hours 1 minute', now() - interval '26 hours', '200');
select is(public.health_ok(), false, 'the last success exactly 26 hours ago: missed');
insert into public.job_runs (started_at, finished_at, result, failed) values (now() - interval '1 hour', now() - interval '1 hour', '200-deletion-failed', 2);
insert into public.job_runs (started_at, finished_at, result) values (now() - interval '30 minutes', now() - interval '30 minutes', '503');
select is(public.health_ok(), false, 'recent failed runs do not count as a success');
select is(pg_temp.usage() ->> 'last_attempt_result', '503', 'the last attempt is the newest run, whatever its result');
select is((pg_temp.usage() ->> 'last_success_at')::timestamptz, now() - interval '26 hours', 'the last success is older than the last attempt');
insert into public.job_runs (started_at, finished_at, result) values (now() - interval '26 hours', now() - interval '25 hours 59 minutes', '200');
select is(public.health_ok(), true, 'a success 25 hours 59 minutes ago: still healthy (the cron may drift up to 59 minutes)');

-- Retention (Q45): each record deletes runs older than 30 days.
insert into public.job_runs (started_at, finished_at, result) values
  (now() - interval '31 days', now() - interval '31 days', '200'),
  (now() - interval '29 days', now() - interval '29 days', '200');
select public.worker_job_record(now(), '200', 0, 0, 0, 0, 0);
select is((select count(*) from public.job_runs r where r.finished_at < now() - interval '30 days'), 0::bigint, 'runs older than 30 days are deleted');
select is((select count(*) from public.job_runs r where r.finished_at = now() - interval '29 days'), 1::bigint, 'a 29-day-old run is kept');

-- Who reads usage: the owner only (a co-editor is refused, E33; no page: null; the other page is never reached, E56).
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e2');
select is(pg_temp.usage(), null, 'a co-editor reads nothing');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e3');
select is(pg_temp.usage(), null, 'a user without a page reads nothing');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e4');
select is(pg_temp.usage() - 'read_at' - 'page_created_at' - 'timezone' - 'last_attempt_at' - 'last_attempt_result' - 'last_success_at'
    - 'last_success_corrections' - 'has_run',
  jsonb_build_object('total_bytes', public.storage_used('00000000-0000-0000-0000-0000000000a2'), 'budget_bytes', 900,
    'uploading_bytes', 500, 'deleting_bytes', 60),
  'another owner reads only their own page''s bytes');

select * from finish();
rollback;
