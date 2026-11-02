-- A setup save racing Finish (T2.1a, Codex round 3; Q114): a save that names the version Finish will produce
-- waits for Finish and is then refused, so it cannot change the finished page. (The narrowest window, Finish
-- committing between the save's check and its update, cannot be paused from outside; owner_save_page closes it by
-- locking the page row before the check.) One transaction cannot interleave sessions, so this test drives three
-- real sessions through dblink. Their rows are committed, so the test removes them at the start
-- (an interrupted run) and at the end. The loopback uses the container's network name: dblink needs password
-- authentication, and local connections are trusted. Placeholder data only.
begin;
create extension if not exists dblink with schema extensions;
select plan(5);

select extensions.dblink_connect(c, 'host=supabase_db_vegenus dbname=postgres user=postgres password=postgres')
from unnest(array['setup', 'save', 'finish']) c;
create temp table race (pid int);
insert into race select * from extensions.dblink('save', 'select pg_backend_pid()') as t(pid int);

select extensions.dblink_exec('setup', $$
  delete from public.pages where id = '00000000-0000-0000-0000-0000000000a9';
  delete from auth.users where id = '00000000-0000-0000-0000-0000000000f9';
  insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f9', 'race-owner@example.test');
  insert into public.pages (id, theme, default_lang, timezone) values ('00000000-0000-0000-0000-0000000000a9', 'a_dreamy', 'en', 'UTC');
  insert into public.memberships (page_id, user_id, role)
    values ('00000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-0000000000f9', 'owner') $$);

-- Finish holds the page row, as T2.7's Finish will; the save names version 2, which Finish produces.
select extensions.dblink_exec('finish', 'begin');
select * from extensions.dblink('finish', $$ select 1 from public.pages where id = '00000000-0000-0000-0000-0000000000a9' for update $$) as t(x int);
select * from extensions.dblink('save', $$ select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f9","role":"authenticated"}', false) $$) as t(x text);
select extensions.dblink_send_query('save', $$ select public.owner_save_page(2, 'c_cozy', 'vi', null, null, 'UTC', '{together}') $$);

-- Wait until the save is blocked behind Finish's lock (about 5 s at most); without that wait the race is not tested.
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
select ok((select w.blocked from waited w), 'the save waited behind Finish''s lock');

select extensions.dblink_exec('finish', $$ update public.pages set setup_completed_at = now() where id = '00000000-0000-0000-0000-0000000000a9' $$);
select extensions.dblink_exec('finish', 'commit');
create temp table outcome as select * from extensions.dblink_get_result('save', false) as t(saved int);

select is((select count(saved) from outcome), 0::bigint, 'the save that raced Finish returned no version');
select matches(extensions.dblink_error_message('save'), 'setup is finished', 'it was refused because setup is finished');
select is((select p.theme::text || ' ' || p.version from public.pages p where p.id = '00000000-0000-0000-0000-0000000000a9'),
  'a_dreamy 2', 'the finished page kept its choices');
select is((select count(*) from public.page_sections s where s.page_id = '00000000-0000-0000-0000-0000000000a9' and s.enabled),
  0::bigint, 'and its sections');

select extensions.dblink_exec('setup', $$
  delete from public.pages where id = '00000000-0000-0000-0000-0000000000a9';
  delete from auth.users where id = '00000000-0000-0000-0000-0000000000f9' $$);
select extensions.dblink_disconnect(c) from unnest(array['setup', 'save', 'finish']) c;

select * from finish();
rollback;
