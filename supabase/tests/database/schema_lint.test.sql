-- Schema lint (T1.3; design 3 §1, §5, §9; E6, E36): deny by default for every table and function in `public`.
begin;
select plan(11);

select tables_are('public', array['pages', 'page_sections', 'memberships', 'guest_tokens', 'items', 'guestbook_entries', 'rate_limit_hits',
  'copy_keys', 'page_copy', 'item_tombstones', 'media', 'media_variants', 'upload_reservations', 'storage_deletions', 'home_picks', 'job_runs', 'settings_saves'], 'the T1.3, T1.4, T2.7, T2.2, T2.3a, T2.4, T2.5 and T2.6 tables exist');

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
-- `copy_keys` is reference data shared by every page (design 3 §3.12). `job_runs` is operational: the daily job runs for
-- every page at once (design 3 §3.9, Q145).
select is((
  select array_agg(c.relname::text order by c.relname) from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
    and not exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'page_id' and not a.attisdropped)
    and c.relname <> all (array['pages', 'rate_limit_hits', 'copy_keys', 'job_runs']::name[])
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
), array['owner_copy_accept_defaults', 'owner_copy_drafts', 'owner_home_get', 'owner_home_photos', 'owner_home_save', 'owner_item_delete', 'owner_item_get', 'owner_item_save', 'owner_item_set_status', 'owner_items_list', 'owner_media_delete', 'owner_media_readable', 'owner_page', 'owner_rotate_token', 'owner_save_page', 'owner_save_sections', 'owner_save_settings', 'owner_set_visibility', 'owner_token_shown', 'owner_upload_admitted', 'owner_upload_begin', 'owner_upload_cancel', 'owner_upload_complete', 'owner_usage'],
  'authenticated executes only the owner functions (account_* come in T3.6)');

select is((
  select array_agg(p.proname::text order by p.proname) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and has_function_privilege('vegenus_server', p.oid, 'execute')
), array['guest_exchange_attempt', 'health_ok', 'login_attempt', 'worker_deletion_done', 'worker_due_deletions', 'worker_expire_uploads', 'worker_job_record', 'worker_reconcile'],
  'vegenus_server executes only the login and exchange limiters, the storage worker, its run record and health (guest writes come later)');

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
