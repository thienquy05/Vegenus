-- Schema lint (T1.3; design 3 §1, §5, §9; E6, E36): deny by default for every table and function in `public`.
begin;
select plan(11);

select tables_are('public', array['pages', 'page_sections', 'memberships', 'guest_tokens', 'items', 'guestbook_entries', 'rate_limit_hits'],
  'the T1.3 and T1.4 tables exist');

select ok(exists (
  select 1 from pg_roles where rolname = 'vegenus_server'
    and not rolcanlogin and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb
), 'vegenus_server exists without login, superuser, BYPASSRLS or role creation');

select is((
  select array_agg(c.relname::text order by c.relname) from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity
), null, 'every table in public has RLS enabled');

-- Tables without page_id must be on design 3 §1's exception list; later units add theirs here.
-- `pages` is the tenant itself: its `id` is the page id. `rate_limit_hits` is operational (design 3 §1).
select is((
  select array_agg(c.relname::text order by c.relname) from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
    and not exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'page_id' and not a.attisdropped)
    and c.relname <> all (array['pages', 'rate_limit_hits']::name[])
), null, 'every table has page_id or is a listed exception');

select is((
  select array_agg(r || ':' || c.relname order by r, c.relname) from pg_class c
  cross join unnest(array['anon', 'authenticated', 'vegenus_server']) r
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and (has_table_privilege(r, c.oid, 'select, insert, update, delete, truncate, references, trigger')
      or has_any_column_privilege(r, c.oid, 'select, insert, update, references'))
), null, 'anon, authenticated and vegenus_server hold no table privileges');

select is((
  select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prosecdef
    and not coalesce('search_path=""' = any (p.proconfig), false)
), null, 'every SECURITY DEFINER function sets an empty search_path');

select is((
  select array_agg(p.proname::text order by p.proname) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')
), array['guest_guestbook_list', 'guest_list', 'guest_open', 'public_guestbook_list', 'public_list', 'public_open'],
  'anon executes exactly the guest_* and public_* read functions');

select is((
  select array_agg(p.proname::text order by p.proname) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and has_function_privilege('authenticated', p.oid, 'execute')
), array['owner_rotate_token'], 'authenticated executes only owner_rotate_token (account_* come in T3.6)');

select is((
  select array_agg(p.proname::text order by p.proname) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and has_function_privilege('vegenus_server', p.oid, 'execute')
), array['guest_exchange_attempt', 'login_attempt'], 'vegenus_server executes only the login and exchange limiters (guest writes come later)');

select is((
  select array_agg(p.oid::regprocedure::text) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')
    and 'page_id' = any (p.proargnames)
), null, 'no anon-executable function takes a page_id');

-- Future functions: the default must not let PUBLIC (and so anon) execute a new function.
create function public.lint_probe() returns int language sql security definer set search_path = '' as 'select 1';
select ok(not has_function_privilege('anon', 'public.lint_probe()', 'execute')
  and not has_function_privilege('authenticated', 'public.lint_probe()', 'execute'),
  'a newly created function is not executable by anon or authenticated');

select * from finish();
rollback;
