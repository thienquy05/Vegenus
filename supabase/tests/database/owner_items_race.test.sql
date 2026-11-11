-- Two editors on one item (T2.2, E15; Codex review of T2.2): both read version 1 and save. The second save waits
-- on the first one's row lock and, once the first commits, changes nothing and answers no version, so the first
-- editor's text is never silently overwritten. One transaction cannot interleave sessions, so this test drives
-- real sessions through dblink, as page_setup_race.test.sql does. Their rows are committed, so the test removes
-- them at the start (an interrupted run) and at the end. Placeholder data only.
begin;
create extension if not exists dblink with schema extensions;
select plan(9);

select extensions.dblink_connect(c, 'host=supabase_db_vegenus dbname=postgres user=postgres password=postgres')
from unnest(array['setup', 'first', 'second']) c;
create temp table race (pid int);
insert into race select * from extensions.dblink('second', 'select pg_backend_pid()') as t(pid int);

select extensions.dblink_exec('setup', $$
  delete from public.pages where id = '00000000-0000-0000-0000-0000000000a8';
  delete from auth.users where id = '00000000-0000-0000-0000-0000000000f8';
  insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f8', 'race-editor@example.test');
  insert into public.pages (id, theme, default_lang, timezone) values ('00000000-0000-0000-0000-0000000000a8', 'a_dreamy', 'en', 'UTC');
  insert into public.memberships (page_id, user_id, role)
    values ('00000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-0000000000f8', 'owner');
  insert into public.items (id, page_id, kind, lang, title, event_date, date_precision)
    values ('00000000-0000-0000-0000-0000000000b8', '00000000-0000-0000-0000-0000000000a8', 'memory', 'en', 'Original', '2024-05-01', 'day'),
      ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-0000000000a8', 'memory', 'en', 'Retried', '2024-05-01', 'day') $$);

select x from unnest(array['first', 'second']) c, extensions.dblink(c, $$ select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f8","role":"authenticated"}', false) $$) as t(x text);

-- The first editor saves inside an open transaction, so it holds the row.
select extensions.dblink_exec('first', 'begin');
select * from extensions.dblink('first', $$ select public.owner_item_save('00000000-0000-0000-0000-0000000000b8', 1, 'memory',
  'en', 'From the first editor', null, null, null, null, '2024-05-01', 'day', false, false) $$) as t(saved jsonb);
select extensions.dblink_send_query('second', $$ select public.owner_item_save('00000000-0000-0000-0000-0000000000b8', 1,
  'memory', 'en', 'From the second editor', null, null, null, null, '2024-05-01', 'day', false, false) $$);

-- Wait until the second save is blocked behind the first one's lock; without that wait the race is not tested.
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
select ok((select w.blocked from waited w), 'the second save waited behind the first');

select extensions.dblink_exec('first', 'commit');
create temp table outcome as select * from extensions.dblink_get_result('second') as t(saved jsonb);
select * from extensions.dblink_get_result('second') as t(saved jsonb); -- the empty end of the async query, so the connection is free again

select is((select count(*) from outcome), 1::bigint, 'the second save finished');
select is((select saved from outcome), null, 'and answered no version: changed elsewhere (E15)');
select is((select i.title from public.items i where i.id = '00000000-0000-0000-0000-0000000000b8'), 'From the first editor',
  'the first editor''s text was kept');
select is((select i.version from public.items i where i.id = '00000000-0000-0000-0000-0000000000b8'), 2,
  'and the item moved on exactly once');

-- A create retry racing a delete (Codex round 3): the first session deletes the item inside an open transaction; the
-- second retries the item's original create, waits on the row, and once the delete commits must not bring it back.
truncate race;
truncate waited;
insert into race select * from extensions.dblink('second', 'select pg_backend_pid()') as t(pid int);
select extensions.dblink_exec('first', 'begin');
select * from extensions.dblink('first', $$ select public.owner_item_delete('00000000-0000-0000-0000-0000000000b9', 1) $$) as t(deleted boolean);
select extensions.dblink_send_query('second', $$ select public.owner_item_save('00000000-0000-0000-0000-0000000000b9', null,
  'memory', 'en', 'Retried', null, null, null, null, '2024-05-01', 'day', false, false) $$);
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
select ok((select w.blocked from waited w), 'the create retry waited behind the delete');
select extensions.dblink_exec('first', 'commit');
create temp table retried as select * from extensions.dblink_get_result('second') as t(saved jsonb);
select is((select count(*) from retried), 1::bigint, 'the create retry finished');
select is((select saved from retried), null, 'and answered no version');
select is((select count(*) from public.items i where i.id = '00000000-0000-0000-0000-0000000000b9'), 0::bigint,
  'the deleted item was not brought back');

select extensions.dblink_exec('setup', $$
  delete from public.pages where id = '00000000-0000-0000-0000-0000000000a8';
  delete from auth.users where id = '00000000-0000-0000-0000-0000000000f8' $$);
select extensions.dblink_disconnect(c) from unnest(array['setup', 'first', 'second']) c;

select * from finish();
rollback;
