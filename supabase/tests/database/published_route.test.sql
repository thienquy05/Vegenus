-- Published address (T3.1p; PRD Q151, Q155-Q157; owner UI "O9 Published address"; design 1 §5.1, §10.2). E5, E6, E21,
-- E47. owner_set_visibility takes the draft's base {visibility, vanity_name, has_link} and the page address: a committed
-- request id answers the snapshot first, a changed base answers null (conflict) and applies nothing, Published needs a
-- valid name nobody else holds, current and retired names stay reserved for their page forever (page_vanity_names; only
-- the same page takes one back), and other visibility writes keep the reservation. owner_page() carries vanity_name.
-- public_item and public_media read a Published page by its current address only. Placeholder data only.
begin;
select plan(45);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000f2', 'other-owner@example.test'),
  ('00000000-0000-0000-0000-0000000000f3', 'unpublished-owner@example.test');
-- A: f1's live Token-only page with a guest link and no address. B: f2's Published page at taken-page, which also
-- retired old-b. N: f3's page, wording never published.
insert into public.pages (id, theme, default_lang, visibility, timezone, vanity_name, copy_published_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'a_dreamy', 'en', 'token_only', 'UTC', null, now()),
  ('00000000-0000-0000-0000-0000000000a2', 'b_cosmic', 'vi', 'published', 'UTC', 'old-b', now()),
  ('00000000-0000-0000-0000-0000000000a3', 'c_cozy', 'en', 'token_only', 'UTC', null, null);
update public.pages set vanity_name = 'taken-page' where id = '00000000-0000-0000-0000-0000000000a2';
update public.page_sections set enabled = true where section in ('home', 'memories');
insert into public.memberships (page_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', 'owner'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000f2', 'owner'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000f3', 'owner');
insert into public.guest_tokens (page_id, version, token_hash, request_id) values
  ('00000000-0000-0000-0000-0000000000a1', 1, sha256('token-a'::bytea), gen_random_uuid());
-- b1 A's published memory, b2 A's draft memory, b9 B's published memory; c1/c2/c9 their ready photos.
insert into public.items (id, page_id, kind, lang, title, event_date, date_precision, status, sort_order) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'memory', 'en', 'Beach', '2023-07-01', 'day', 'draft', 1),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'memory', 'en', 'Draft', '2024-01-01', 'day', 'draft', 2),
  ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-0000000000a2', 'memory', 'vi', 'Other page', '2023-07-01', 'day', 'draft', 1);
update public.items i set status = 'published', published = public.item_snapshot(i) where i.id <> '00000000-0000-0000-0000-0000000000b2';
insert into public.media (id, page_id, item_id, kind, state, position, width, height) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'photo', 'ready', 0, 800, 600),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'photo', 'ready', 0, 800, 600),
  ('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b9', 'photo', 'ready', 0, 800, 600);
insert into public.media_variants (media_id, page_id, variant, bucket, path, mime, bytes, write_until)
select m.id, m.page_id, v, public.media_bucket(v), 'p/' || m.id || '/' || v, 'image/webp', 10, now()
from public.media m cross join unnest('{thumb,display,full}'::public.media_variant[]) v;

create function pg_temp.act_as(id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.page_a() returns public.pages language sql as $$
  select * from public.pages where id = '00000000-0000-0000-0000-0000000000a1'
$$;
-- The base O9 sends: the saved visibility, address and link availability.
create function pg_temp.base(v text, name text, link boolean default true) returns jsonb language sql as $$
  select jsonb_build_object('visibility', base.v, 'vanity_name', base.name, 'has_link', base.link)
$$;
create function pg_temp.media(sel text, ids uuid[], v public.media_variant) returns uuid[] language sql as $$
  select coalesce(array_agg(g.media_id order by g.media_id), '{}') from public.public_media(media.sel, media.ids, media.v) g
$$;

-- Who may call what.
select ok(has_function_privilege('authenticated', 'public.owner_set_visibility(public.visibility, text, jsonb, uuid)', 'execute'),
  'authenticated can call owner_set_visibility with a base and an address');
select ok(not has_function_privilege('anon', 'public.owner_set_visibility(public.visibility, text, jsonb, uuid)', 'execute'),
  'anon cannot call owner_set_visibility');
select hasnt_function('public', 'owner_set_visibility', array['public.visibility', 'uuid'], 'the save without a base is gone');
select ok(has_function_privilege('anon', 'public.public_item(text, uuid)', 'execute'), 'anon can call public_item');
select ok(has_function_privilege('anon', 'public.public_media(text, uuid[], public.media_variant)', 'execute'),
  'anon can call public_media');
select ok(not has_table_privilege('anon', 'public.page_vanity_names', 'select')
  and not has_table_privilege('authenticated', 'public.page_vanity_names', 'select'), 'no API role reads the reserved names');

-- Existing addresses are reserved: B's current and retired names.
select is((select array_agg(name order by name) from public.page_vanity_names where page_id = '00000000-0000-0000-0000-0000000000a2'),
  array['old-b', 'taken-page'], 'every address a page held is reserved for it');

-- owner_page carries the address.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select ok(public.owner_page() ? 'vanity_name' and public.owner_page() -> 'vanity_name' = 'null'::jsonb,
  'owner_page carries vanity_name, null before any address');

-- A changed base answers null and applies nothing.
select is(public.owner_set_visibility('published', 'our-page', pg_temp.base('private', null), gen_random_uuid()), null,
  'a changed visibility in the base is a conflict');
select is(public.owner_set_visibility('published', 'our-page', pg_temp.base('token_only', 'someone'), gen_random_uuid()), null,
  'a changed address in the base is a conflict');
select is(public.owner_set_visibility('published', 'our-page', pg_temp.base('token_only', null, false), gen_random_uuid()), null,
  'a changed link availability in the base is a conflict');
select is((pg_temp.page_a()).visibility::text || ' ' || coalesce((pg_temp.page_a()).vanity_name, '-'), 'token_only -',
  'a conflict changes nothing');

-- Refused inputs.
select throws_ok($$ select public.owner_set_visibility('published', null, pg_temp.base('token_only', null), gen_random_uuid()) $$,
  '22023', null, 'Published needs an address');
select throws_ok($$ select public.owner_set_visibility('published', 'Bad Name', pg_temp.base('token_only', null), gen_random_uuid()) $$,
  '23514', null, 'an address outside the name rules is refused');
select throws_ok($$ select public.owner_set_visibility('published', 'a--b', pg_temp.base('token_only', null), gen_random_uuid()) $$,
  '23514', null, 'a doubled hyphen is refused');
select throws_ok($$ select public.owner_set_visibility('published', 'ab', pg_temp.base('token_only', null), gen_random_uuid()) $$,
  '23514', null, 'an address under 3 characters is refused');
select throws_ok($$ select public.owner_set_visibility('published', 'taken-page', pg_temp.base('token_only', null), gen_random_uuid()) $$,
  '23505', null, 'another page''s current address is taken');
select throws_ok($$ select public.owner_set_visibility('published', 'old-b', pg_temp.base('token_only', null), gen_random_uuid()) $$,
  '23505', null, 'another page''s retired address is taken');
select throws_ok($$ select public.owner_set_visibility('published', 'our-page', pg_temp.base('token_only', null), null) $$,
  '22023', null, 'a save needs a request id');
select throws_ok($$ select public.owner_set_visibility('published', 'our-page', null, gen_random_uuid()) $$,
  '22023', null, 'a save needs a base');
select is((pg_temp.page_a()).visibility::text, 'token_only', 'refused saves change nothing');

-- First publish.
create temp table first as
  select public.owner_set_visibility('published', 'our-page', pg_temp.base('token_only', null), '00000000-0000-0000-0000-0000000000e1') as snap;
select is((select snap ->> 'visibility' || ' ' || (snap ->> 'vanity_name') from first), 'published our-page',
  'publishing answers the snapshot with the address');
select isnt(public.public_open('our-page'), null, 'the page opens at its address');
select isnt(public.guest_open('token-a'), null, 'the guest link keeps working');
-- A retry of the committed request answers the current snapshot before the base check.
select is(public.owner_set_visibility('published', 'our-page', pg_temp.base('token_only', null), '00000000-0000-0000-0000-0000000000e1'),
  public.owner_page(), 'a committed request id answers the snapshot and applies nothing');

-- Rename: the old address stops at once and stays reserved for this page.
select is(public.owner_set_visibility('published', 'new-page', pg_temp.base('published', 'our-page'), gen_random_uuid()) ->> 'vanity_name',
  'new-page', 'a rename saves the new address');
select is(public.public_open('our-page'), null, 'the old address stops opening');
select isnt(public.public_open('new-page'), null, 'the new address opens the page');
select is((select array_agg(name order by name) from public.page_vanity_names where page_id = '00000000-0000-0000-0000-0000000000a1'),
  array['new-page', 'our-page'], 'both addresses stay reserved for the page');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f2');
select throws_ok($$ select public.owner_set_visibility('published', 'our-page', pg_temp.base('published', 'taken-page', false), gen_random_uuid()) $$,
  '23505', null, 'another page cannot take a retired address');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');

-- Leaving Published keeps the address, whatever name is sent.
select is(public.owner_set_visibility('token_only', 'ignored-name', pg_temp.base('published', 'new-page'), gen_random_uuid()) ->> 'vanity_name',
  'new-page', 'Token-only keeps the address and ignores a sent name');
select is(public.public_open('new-page'), null, 'Token-only: the address stops opening (E47)');
select isnt(public.guest_open('token-a'), null, 'Token-only: the guest link works');
select is(public.owner_set_visibility('private', null, pg_temp.base('token_only', 'new-page'), gen_random_uuid()) ->> 'vanity_name',
  'new-page', 'Private keeps the address');

-- The same page takes a retired address back.
select is(public.owner_set_visibility('published', 'our-page', pg_temp.base('private', 'new-page'), gen_random_uuid()) ->> 'vanity_name',
  'our-page', 'the page takes its retired address back');
select isnt(public.public_open('our-page'), null, 'the reclaimed address opens the page again');

-- The wording gate covers Published.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f3');
select throws_ok($$ select public.owner_set_visibility('published', 'page-n', pg_temp.base('token_only', null, false), gen_random_uuid()) $$,
  '55000', null, 'Published waits for the first wording publication');

-- public_item: a published memory of a Published page, by its current address only.
select is((select title from public.public_item('our-page', '00000000-0000-0000-0000-0000000000b1')), 'Beach',
  'public_item reads a published memory');
select is((select count(*) from public.public_item('our-page', '00000000-0000-0000-0000-0000000000b2')), 0::bigint,
  'public_item: a draft is not found');
select is((select count(*) from public.public_item('our-page', '00000000-0000-0000-0000-0000000000b9')), 0::bigint,
  'public_item: another page''s item is not found (E6)');
select is((select count(*) from public.public_item('new-page', '00000000-0000-0000-0000-0000000000b1')), 0::bigint,
  'public_item: a retired address reads nothing');
select is((select count(*) from public.public_item('token-a', '00000000-0000-0000-0000-0000000000b1')), 0::bigint,
  'public_item: a guest token is not an address');

-- public_media: the same rule as guest_media, through the address.
select is(pg_temp.media('our-page', array['00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2',
  '00000000-0000-0000-0000-0000000000c9']::uuid[], 'display'), array['00000000-0000-0000-0000-0000000000c1']::uuid[],
  'public_media admits only the page''s published media (E56)');
select is(pg_temp.media('our-page', array['00000000-0000-0000-0000-0000000000c1']::uuid[], 'full'), '{}'::uuid[],
  'public_media never admits the full-size original');
select throws_ok($$ select * from public.public_media('our-page', array_fill(gen_random_uuid(), array[101]), 'thumb') $$,
  '22023', null, 'public_media takes at most 100 ids');

select * from finish();
rollback;
