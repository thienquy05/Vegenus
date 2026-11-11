-- Concurrency of the media functions (T2.3a, Codex review rounds 1 and 2). (1) Two workers confirming the last two
-- files of one failed media: the second waits on the media row and then removes it, never stranding it. (2, 3) A media
-- delete racing expiry or cancel: every function locks the media row before its reservation, so they queue instead of
-- deadlocking. The delete is played as its own first step (lock the media row) and then its delete, so the race is
-- forced rather than left to timing. (4) Begin racing an item delete: Begin locks the item before it expires
-- anything, so it never holds an expired media row of that item while waiting for the item (Codex round 3). (5) The
-- reconcile takes the page locks before it adds a charge, so a Begin checking the budget never misses it (Codex T2.3c). Real sessions through dblink, as page_setup_race.test.sql does; their rows
-- are committed, so the test removes them at the start and at the end. Placeholder data only.
begin;
create extension if not exists dblink with schema extensions;
select plan(15);

select extensions.dblink_connect(c, 'host=supabase_db_vegenus dbname=postgres user=postgres password=postgres')
from unnest(array['setup', 'first', 'second']) c;
create temp table race (pid int);
insert into race select * from extensions.dblink('second', 'select pg_backend_pid()') as t(pid int);

select extensions.dblink_exec('setup', $$
  delete from public.storage_deletions where page_id = '00000000-0000-0000-0000-0000000000a7';
  delete from public.pages where id = '00000000-0000-0000-0000-0000000000a7';
  delete from auth.users where id = '00000000-0000-0000-0000-0000000000f7';
  insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f7', 'race-owner@example.test');
  insert into public.pages (id, theme, default_lang, timezone) values ('00000000-0000-0000-0000-0000000000a7', 'a_dreamy', 'en', 'UTC');
  insert into public.items (id, page_id, kind, lang, title, event_date, date_precision)
    values ('00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-0000000000a7', 'memory', 'en', 'Race', '2024-05-01', 'day');
  insert into public.memberships (page_id, user_id, role)
    values ('00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000f7', 'owner');
  insert into public.media (id, page_id, item_id, kind, state)
    values ('00000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000b7', 'photo', 'failed');
  insert into public.storage_deletions (page_id, media_id, bucket, path, bytes, not_before) values
    ('00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000c7', 'media-thumb', 'race/thumb', 10, now() - interval '1 minute'),
    ('00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000c7', 'media-display', 'race/display', 10, now() - interval '1 minute') $$);

select extensions.dblink_exec('first', 'begin');
select * from extensions.dblink('first', $$ select public.worker_deletion_done(d.id) from public.storage_deletions d where d.path = 'race/thumb' $$) as t(done boolean);
select extensions.dblink_send_query('second', $$ select public.worker_deletion_done(d.id) from public.storage_deletions d where d.path = 'race/display' $$);

create temp table waited (blocked boolean);
do $$
declare
  blocked boolean := false;
begin
  for i in 1..100 loop
    perform pg_stat_clear_snapshot();
    blocked := exists (select 1 from pg_stat_activity a join race r on a.pid = r.pid where a.wait_event_type = 'Lock');
    exit when blocked;
    perform pg_sleep(0.05);
  end loop;
  insert into waited values (blocked);
end
$$;
select ok((select w.blocked from waited w), 'the second confirmation waited for the first');

select extensions.dblink_exec('first', 'commit');
create temp table outcome as select * from extensions.dblink_get_result('second') as t(done boolean);
select is((select done from outcome), true, 'the second confirmation finished');
select is((select count(*) from public.media m where m.id = '00000000-0000-0000-0000-0000000000c7'), 0::bigint,
  'the failed media row is removed once both files are confirmed gone');

select * from extensions.dblink_get_result('second') as t(done boolean); -- the empty end of the async query

-- (2) Expiry racing a media delete.
create function pg_temp.wait_blocked() returns boolean language plpgsql as $$
declare
  blocked boolean := false;
begin
  for i in 1..100 loop
    perform pg_stat_clear_snapshot();
    blocked := exists (select 1 from pg_stat_activity a join race r on a.pid = r.pid where a.wait_event_type = 'Lock');
    exit when blocked;
    perform pg_sleep(0.05);
  end loop;
  return blocked;
end
$$;
select extensions.dblink_exec('setup', $$
  insert into public.media (id, page_id, item_id, kind) values
    ('00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000b7', 'photo'),
    ('00000000-0000-0000-0000-0000000000e7', '00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000b7', 'photo');
  insert into public.upload_reservations (media_id, page_id, files, charged_bytes, write_until) values
    ('00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000a7',
      '[{"variant": "thumb", "bucket": "media-thumb", "path": "race/d7", "max_bytes": 5}]', 5, now() - interval '1 minute'),
    ('00000000-0000-0000-0000-0000000000e7', '00000000-0000-0000-0000-0000000000a7',
      '[{"variant": "thumb", "bucket": "media-thumb", "path": "race/e7", "max_bytes": 7}]', 7, now() + interval '1 hour') $$);
select extensions.dblink_exec('first', 'begin');
select * from extensions.dblink('first', $$ select 1 from public.media where id = '00000000-0000-0000-0000-0000000000d7' for update $$) as t(x int);
select extensions.dblink_send_query('second', 'select public.worker_expire_uploads()');
select ok(pg_temp.wait_blocked(), 'expiry waits on the media row the delete holds');
select is(extensions.dblink_exec('first', $$ delete from public.media where id = '00000000-0000-0000-0000-0000000000d7' $$, false),
  'DELETE 1', 'the media delete goes through: no deadlock');
select extensions.dblink_exec('first', 'commit');
create temp table expired as select * from extensions.dblink_get_result('second', false) as t(n int);
select * from extensions.dblink_get_result('second', false) as t(n int);
select is(extensions.dblink_error_message('second'), 'OK', 'and expiry finishes without error');
select is((select sum(d.bytes) from public.storage_deletions d where d.path = 'race/d7'), 5::numeric,
  'the reservation charge moved to the queue exactly once');

-- (3) Cancel racing a media delete.
select * from extensions.dblink('second', $$ select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f7","role":"authenticated"}', false) $$) as t(x text);
select extensions.dblink_exec('first', 'begin');
select * from extensions.dblink('first', $$ select 1 from public.media where id = '00000000-0000-0000-0000-0000000000e7' for update $$) as t(x int);
select extensions.dblink_send_query('second', $$ select public.owner_upload_cancel('00000000-0000-0000-0000-0000000000e7') $$);
select ok(pg_temp.wait_blocked(), 'cancel waits on the media row the delete holds');
select is(extensions.dblink_exec('first', $$ delete from public.media where id = '00000000-0000-0000-0000-0000000000e7' $$, false),
  'DELETE 1', 'the media delete goes through: no deadlock');
select extensions.dblink_exec('first', 'commit');
create temp table cancelled as select * from extensions.dblink_get_result('second', false) as t(done boolean);
select is((select done from cancelled), false, 'and cancel then finds nothing left to cancel');

select * from extensions.dblink_get_result('second', false) as t(done boolean); -- the empty end of the async query

-- (4) Begin racing an item delete; the item holds an upload whose write window has passed.
select extensions.dblink_exec('setup', $$
  insert into public.items (id, page_id, kind, lang, title, event_date, date_precision)
    values ('00000000-0000-0000-0000-0000000000b6', '00000000-0000-0000-0000-0000000000a7', 'memory', 'en', 'Race 4', '2024-05-01', 'day');
  insert into public.media (id, page_id, item_id, kind)
    values ('00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000b6', 'photo');
  insert into public.upload_reservations (media_id, page_id, files, charged_bytes, write_until) values
    ('00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-0000000000a7',
      '[{"variant": "thumb", "bucket": "media-thumb", "path": "race/c6", "max_bytes": 3}]', 3, now() - interval '1 minute') $$);
select extensions.dblink_exec('first', 'begin');
select * from extensions.dblink('first', $$ select 1 from public.items where id = '00000000-0000-0000-0000-0000000000b6' for update $$) as t(x int);
select extensions.dblink_send_query('second', $$ select public.owner_upload_begin('00000000-0000-0000-0000-0000000000b6', 'photo', '{thumb,display}') $$);
select ok(pg_temp.wait_blocked(), 'Begin waits on the item the delete holds');
select is(extensions.dblink_exec('first', $$ delete from public.items where id = '00000000-0000-0000-0000-0000000000b6' $$, false),
  'DELETE 1', 'the item delete goes through: no deadlock');
select extensions.dblink_exec('first', 'commit');
create temp table begun as select * from extensions.dblink_get_result('second', false) as t(upload jsonb);
select * from extensions.dblink_get_result('second', false) as t(upload jsonb);
select is(extensions.dblink_error_message('second'), 'OK', 'and Begin finishes without error');
select is((select upload from begun), null, 'answering null: the item is gone');

select * from extensions.dblink_get_result('second', false) as t(upload jsonb); -- the empty end of the async query

-- (5) Reconcile racing Begin's budget check: Begin holds the page row while it reads usage.
select extensions.dblink_exec('first', 'begin');
select * from extensions.dblink('first', $$ select 1 from public.pages where id = '00000000-0000-0000-0000-0000000000a7' for update $$) as t(x int);
select extensions.dblink_send_query('second', 'select public.worker_reconcile()');
select ok(pg_temp.wait_blocked(), 'the reconcile waits for the page lock before changing any charge');
select extensions.dblink_exec('first', 'commit');
select * from extensions.dblink_get_result('second', false) as t(r jsonb);
select * from extensions.dblink_get_result('second', false) as t(r jsonb);

select extensions.dblink_exec('setup', $$
  delete from public.storage_deletions where page_id = '00000000-0000-0000-0000-0000000000a7';
  delete from public.pages where id = '00000000-0000-0000-0000-0000000000a7';
  delete from auth.users where id = '00000000-0000-0000-0000-0000000000f7' $$);
select extensions.dblink_disconnect(c) from unnest(array['setup', 'first', 'second']) c;

select * from finish();
rollback;
