-- Two sessions create Home at once (T2.4; PRD Q144 defaults 10 and 18): both open the editor with no Home and save
-- under their own new id. The second create waits on the first one's insert and, once it commits, answers no
-- version (a conflict, never an outage), so the screen re-reads the existing Home. Real sessions through dblink, as
-- owner_items_race.test.sql. Their rows are committed, so the test removes them at the start and at the end.
-- Placeholder data only.
begin;
create extension if not exists dblink with schema extensions;
select plan(12);

select extensions.dblink_connect(c, 'host=supabase_db_vegenus dbname=postgres user=postgres password=postgres')
from unnest(array['setup', 'first', 'second']) c;
create temp table race (pid int);
insert into race select * from extensions.dblink('second', 'select pg_backend_pid()') as t(pid int);

select extensions.dblink_exec('setup', $$
  delete from public.pages where id = '00000000-0000-0000-0000-0000000000aa';
  delete from auth.users where id = '00000000-0000-0000-0000-0000000000fa';
  insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000fa', 'race-home@example.test');
  insert into public.pages (id, theme, default_lang, timezone) values ('00000000-0000-0000-0000-0000000000aa', 'a_dreamy', 'en', 'UTC');
  insert into public.memberships (page_id, user_id, role)
    values ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-0000000000fa', 'owner') $$);

select x from unnest(array['first', 'second']) c, extensions.dblink(c, $$ select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000fa","role":"authenticated"}', false) $$) as t(x text);

select extensions.dblink_exec('first', 'begin');
select * from extensions.dblink('first', $$ select public.owner_home_save('00000000-0000-0000-0000-0000000000d7', null, 'en',
  'From the first session', null, null, null, '{}') $$) as t(saved jsonb);
select extensions.dblink_send_query('second', $$ select public.owner_home_save('00000000-0000-0000-0000-0000000000d8', null,
  'en', 'From the second session', null, null, null, '{}') $$);

-- Wait until the second create is blocked behind the first one's insert; without that wait the race is not tested.
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
select ok((select w.blocked from waited w), 'the second create waited behind the first');

select extensions.dblink_exec('first', 'commit');
create temp table outcome as select * from extensions.dblink_get_result('second') as t(saved jsonb);
select * from extensions.dblink_get_result('second') as t(saved jsonb); -- the empty end of the async query

select is((select count(*) from outcome), 1::bigint, 'the second create finished without an error');
select is((select saved from outcome), null, 'and answered no version, so the screen re-reads the existing Home');
select is((select count(*) from public.items i where i.page_id = '00000000-0000-0000-0000-0000000000aa' and i.kind = 'home'),
  1::bigint, 'the page has one Home');
select is((select i.body from public.items i where i.page_id = '00000000-0000-0000-0000-0000000000aa'), 'From the first session',
  'the first session''s');

-- A photo deleted while a save picks it (reviewer, T2.4a): the first session deletes the photo inside an open
-- transaction; the second saves Home with it as a pick. The save must wait for the delete and then leave the photo
-- out (a deleted photo drops out), not fail on the foreign key (a 503 for the owner).
select extensions.dblink_exec('setup', $$
  insert into public.items (id, page_id, kind, lang, title, event_date, date_precision, status, published)
    values ('00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-0000000000aa', 'memory', 'en', 'Trip', '2024-05-01', 'day', 'published', '{}');
  insert into public.media (id, page_id, item_id, kind, state)
    values ('00000000-0000-0000-0000-0000000000ca', '00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-0000000000ba', 'photo', 'ready') $$);
truncate race;
truncate waited;
insert into race select * from extensions.dblink('second', 'select pg_backend_pid()') as t(pid int);
select extensions.dblink_exec('first', 'begin');
select * from extensions.dblink('first', $$ select public.owner_media_delete('00000000-0000-0000-0000-0000000000ca') $$) as t(deleted boolean);
select extensions.dblink_send_query('second', $$ select public.owner_home_save('00000000-0000-0000-0000-0000000000d7', 1, 'en',
  'From the first session', null, null, null, '{00000000-0000-0000-0000-0000000000ca}') $$);
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
select ok((select w.blocked from waited w), 'the save waited behind the photo''s delete');
select extensions.dblink_exec('first', 'commit');
create temp table picked as select * from extensions.dblink_get_result('second') as t(saved jsonb);
select * from extensions.dblink_get_result('second') as t(saved jsonb);
select is((select saved ->> 'version' from picked), '2', 'the save went through');
select is((select count(*) from public.home_picks hp where hp.item_id = '00000000-0000-0000-0000-0000000000d7'), 0::bigint,
  'without the deleted photo');

-- A memory deleted while a save holds its photo (reviewer re-review, T2.4a): a memory delete locks the memory row
-- first, then its media and picks. The save must take the same order (memory rows first), so the delete queues on
-- the memory row and holds nothing the save needs; queuing on a photo instead allows a deadlock (40P01).
select extensions.dblink_exec('setup', $$
  insert into public.items (id, page_id, kind, lang, title, event_date, date_precision, status, published)
    values ('00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-0000000000aa', 'memory', 'en', 'Walk', '2024-06-01', 'day', 'published', '{}');
  insert into public.media (id, page_id, item_id, kind, state)
    values ('00000000-0000-0000-0000-0000000000cb', '00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-0000000000bb', 'photo', 'ready') $$);
truncate race;
truncate waited;
insert into race select * from extensions.dblink('second', 'select pg_backend_pid()') as t(pid int);
select extensions.dblink_exec('first', 'begin');
select * from extensions.dblink('first', $$ select public.owner_home_save('00000000-0000-0000-0000-0000000000d7', 2, 'en',
  'From the first session', null, null, null, '{00000000-0000-0000-0000-0000000000cb}') $$) as t(saved jsonb);
select extensions.dblink_send_query('second', $$ select public.owner_item_delete('00000000-0000-0000-0000-0000000000bb', 1) $$);
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
select ok((select w.blocked from waited w), 'the memory delete waited behind the save');
-- The row a waiting session queues on shows as its tuple lock.
select is((select array_agg(c.relname::text) from pg_locks l join pg_class c on c.oid = l.relation join race r on l.pid = r.pid
  where l.locktype = 'tuple'), array['items'], 'on the memory row, before touching any photo');
select extensions.dblink_exec('first', 'commit');
create temp table deleted as select * from extensions.dblink_get_result('second') as t(done boolean);
select * from extensions.dblink_get_result('second') as t(done boolean);
select is((select done from deleted), true, 'then the memory was deleted');
select is((select count(*) from public.home_picks hp where hp.item_id = '00000000-0000-0000-0000-0000000000d7'), 0::bigint,
  'and its photo left the picks');

select extensions.dblink_exec('setup', $$
  delete from public.pages where id = '00000000-0000-0000-0000-0000000000aa';
  delete from auth.users where id = '00000000-0000-0000-0000-0000000000fa' $$);
select extensions.dblink_disconnect(c) from unnest(array['setup', 'first', 'second']) c;

select * from finish();
rollback;
