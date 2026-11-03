-- Q128 (T2.1b): guests choose the theme, so a page's theme is only the owner's optional suggestion. Setup saves a page
-- with no theme; the owner can set one later and clear it again. Placeholder data only.
begin;
select plan(6);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f9', 'owner@example.test');
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000f9', 'role', 'authenticated')::text, true);

select col_is_null('public', 'pages', 'theme', 'a page may have no theme');
select col_hasnt_default('public', 'pages', 'theme', 'no theme is chosen for the owner');
select is(public.owner_save_page(null, null, 'en', 'Partner A', 'Partner B', 'UTC', '{}'), 1, 'setup creates a page with no theme');
select is(public.owner_page() -> 'theme', 'null'::jsonb, 'the saved page has no theme');
select is(public.owner_save_page(1, 'c_cozy', 'en', 'Partner A', 'Partner B', 'UTC', '{}'), 2, 'the owner can suggest a theme');
select is((select public.owner_save_page(2, null, 'en', 'Partner A', 'Partner B', 'UTC', '{}')
  from (select 1) x where public.owner_page() ->> 'theme' = 'c_cozy'), 3, 'and clear it again');

select * from finish();
rollback;
