-- A default-language change racing a clear of a published text (T2.7, Codex round 6; design 3 §3.12): whichever
-- commits first, the other waits on the page row and is then refused, so a published page's default language
-- stays complete. Same dblink pattern as page_setup_race.test.sql: committed rows are removed at the start and
-- the end. Placeholder data only.
begin;
create extension if not exists dblink with schema extensions;
select plan(8);

select extensions.dblink_connect(c, 'host=supabase_db_vegenus dbname=postgres user=postgres password=postgres')
from unnest(array['setup', 'first', 'second']) c;
create temp table race (pid int);
insert into race select * from extensions.dblink('second', 'select pg_backend_pid()') as t(pid int);

-- A published page (the seed publishes the examples): English default, Vietnamese complete.
create function pg_temp.reset_page() returns void language sql as $$
  select extensions.dblink_exec('setup', $q$
    delete from public.pages where id = '00000000-0000-0000-0000-0000000000a8';
    insert into public.pages (id, theme, default_lang, visibility, timezone, copy_published_at)
      values ('00000000-0000-0000-0000-0000000000a8', 'a_dreamy', 'en', 'token_only', 'UTC', now()) $q$)
$$;
-- True once the 'second' session waits on a lock (about 5 s at most); without that wait the race is not tested.
create function pg_temp.second_blocked() returns boolean language plpgsql as $$
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
create temp table outcome (n text);

-- 1. The default changes to Vietnamese first; the clear of a Vietnamese text waits, then sees the new default.
select pg_temp.reset_page();
select extensions.dblink_exec('first', 'begin');
select extensions.dblink_exec('first', $$ update public.pages set default_lang = 'vi' where id = '00000000-0000-0000-0000-0000000000a8' $$);
select extensions.dblink_send_query('second', $$ update public.page_copy set published_text = null
  where page_id = '00000000-0000-0000-0000-0000000000a8' and key = 'home.days' and lang = 'vi' $$);
select ok(pg_temp.second_blocked(), 'the clear waited behind the default-language change');
select extensions.dblink_exec('first', 'commit');
insert into outcome select * from extensions.dblink_get_result('second', false) as t(n text);
select matches(extensions.dblink_error_message('second'), 'default language is not complete',
  'the clear was refused: Vietnamese is now the default');
select is((select published_text is not null from public.page_copy
    where page_id = '00000000-0000-0000-0000-0000000000a8' and key = 'home.days' and lang = 'vi'),
  true, 'the Vietnamese text is still published');
select is((select default_lang::text from public.pages where id = '00000000-0000-0000-0000-0000000000a8'), 'vi',
  'the default is Vietnamese');
-- drain the connection's final empty result
select * from extensions.dblink_get_result('second', false) as t(n text);

-- 2. A Vietnamese text is cleared first; the default change waits, then sees the incomplete snapshot.
select pg_temp.reset_page();
truncate race;
insert into race select * from extensions.dblink('second', 'select pg_backend_pid()') as t(pid int);
select extensions.dblink_exec('first', 'begin');
select extensions.dblink_exec('first', $$ update public.page_copy set published_text = null
  where page_id = '00000000-0000-0000-0000-0000000000a8' and key = 'home.days' and lang = 'vi' $$);
select extensions.dblink_send_query('second', $$ update public.pages set default_lang = 'vi'
  where id = '00000000-0000-0000-0000-0000000000a8' $$);
select ok(pg_temp.second_blocked(), 'the default-language change waited behind the clear');
select extensions.dblink_exec('first', 'commit');
insert into outcome select * from extensions.dblink_get_result('second', false) as t(n text);
select matches(extensions.dblink_error_message('second'), 'default language is not complete',
  'the change was refused: Vietnamese is no longer complete');
select is((select default_lang::text from public.pages where id = '00000000-0000-0000-0000-0000000000a8'), 'en',
  'the default is still English');
select is((select published_text from public.page_copy
    where page_id = '00000000-0000-0000-0000-0000000000a8' and key = 'home.days' and lang = 'vi'),
  null, 'the Vietnamese text was cleared');

select extensions.dblink_exec('setup', $$ delete from public.pages where id = '00000000-0000-0000-0000-0000000000a8' $$);
select extensions.dblink_disconnect(c) from unnest(array['setup', 'first', 'second']) c;

select * from finish();
rollback;
