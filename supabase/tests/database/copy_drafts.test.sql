-- owner_copy_drafts (T2.1b; O3 step 4, Q124): the owner reads the page's drafted wording, so the wizard's sample
-- shows exactly what Finish publishes. Owner only, like owner_page. Placeholder data only.
begin;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000f2', 'coeditor@example.test'),
  ('00000000-0000-0000-0000-0000000000f3', 'other-owner@example.test');

create function pg_temp.act_as(id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
$$;

select ok(has_function_privilege('authenticated', 'public.owner_copy_drafts()', 'execute')
  and not has_function_privilege('anon', 'public.owner_copy_drafts()', 'execute')
  and not has_function_privilege('vegenus_server', 'public.owner_copy_drafts()', 'execute'),
  'only authenticated can call owner_copy_drafts');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000f3');
select is(public.owner_copy_drafts(), null, 'an account without a page reads nothing');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select is(public.owner_save_page(null, 'a_dreamy', 'en', null, null, 'UTC', '{memories}'), 1, 'the owner creates a page');
select is((select count(*) from jsonb_object_keys(public.owner_copy_drafts())), 27::bigint, 'every key comes back once');
select is(public.owner_copy_drafts() -> 'home.days',
  jsonb_build_object('en', 'Together for {days} days and counting.', 'vi', 'Bên nhau {days} ngày và còn tiếp.'),
  'each key holds its EN and VI drafts, tokens unfilled');

reset role;
update public.page_copy set draft_text = 'Write to us soon'
  where key = 'wishes.button' and lang = 'en'
    and page_id = (select page_id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000f1');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select is(public.owner_copy_drafts() #>> '{wishes.button,en}', 'Write to us soon', 'the draft is read, not the shipped example');

reset role;
insert into public.memberships (page_id, user_id, role)
  values ((select page_id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000f1'),
    '00000000-0000-0000-0000-0000000000f2', 'co_editor');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f2');
select is(public.owner_copy_drafts(), null, 'a co-editor reads nothing through setup');

select set_config('request.jwt.claims', '', true);
select is(public.owner_copy_drafts(), null, 'no signed-in user reads nothing');

-- Another owner reads only their own page's drafts.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f3');
select is(public.owner_save_page(null, 'c_cozy', 'vi', null, null, 'UTC', '{}'), 1, 'another owner creates their own page');
select is(public.owner_copy_drafts() #>> '{wishes.button,en}', 'Write to us', 'and reads its own drafts, not the first owner''s');

select * from finish();
rollback;
