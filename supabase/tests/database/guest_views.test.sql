-- Guest views read path (T3.1a; design 1 §5; design 3 §3.3, §3.12; guest UI §6, §12; PRD Q29, Q144; E5, E6, E13,
-- E56). guest_open also returns the couple's names, time zone, published wording and the published Home with its
-- guest-visible picks; list rows carry their ready media; guest_item reads one item; guest_media returns the
-- storage paths a guest may see, which the server signs for 5 minutes. Placeholder data only.
begin;
select plan(32);

-- A: token-only, everything enabled but Zodiac. B: another page, for foreign ids (E6, E56).
insert into public.pages (id, theme, default_lang, visibility, timezone, label_a, label_b, copy_published_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'a_dreamy', 'en', 'token_only', 'Asia/Ho_Chi_Minh', '[PARTNER_A]', '[PARTNER_B]', now()),
  ('00000000-0000-0000-0000-0000000000a2', 'b_cosmic', 'vi', 'token_only', 'UTC', '[PARTNER_C]', '[PARTNER_D]', now());
insert into public.guest_tokens (page_id, version, token_hash, active, request_id) values
  ('00000000-0000-0000-0000-0000000000a1', 1, sha256('token-a-old'::bytea), false, gen_random_uuid()),
  ('00000000-0000-0000-0000-0000000000a1', 2, sha256('token-a'::bytea), true, gen_random_uuid()),
  ('00000000-0000-0000-0000-0000000000a2', 1, sha256('token-b'::bytea), true, gen_random_uuid());
update public.page_sections set enabled = section <> 'zodiac';
-- A draft change of a published key stays invisible to guests (Q82).
update public.page_copy set draft_text = 'Draft greeting' where page_id = '00000000-0000-0000-0000-0000000000a1'
  and key = 'home.greeting' and lang = 'en';

-- b1 published memory, b2 draft memory, b3 published milestone, b9 page B's published memory, d1 A's Home.
insert into public.items (id, page_id, kind, lang, title, event_date, date_precision, status, sort_order) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'memory', 'en', 'Beach', '2023-07-01', 'day', 'draft', 1),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'memory', 'en', 'Draft', '2024-01-01', 'day', 'draft', 2),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000a1', 'milestone', 'en', 'Moved in', '2022-01-01', 'day', 'draft', 3),
  ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-0000000000a2', 'memory', 'vi', 'Other page', '2023-07-01', 'day', 'draft', 1);
insert into public.items (id, page_id, kind, lang, body, lang_alt, body_alt, start_date, status) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', 'home', 'en', 'Our note', 'vi', 'Lời nhắn', '2020-02-29', 'draft');
update public.items i set status = 'published', published = public.item_snapshot(i) where i.id <> '00000000-0000-0000-0000-0000000000b2';

-- c1 ready photo of b1 (position 1), c2 ready video of b1 (position 0), c3 unfinished photo of b1, c4 ready photo of
-- the draft b2, c5 ready photo of the milestone b3, c9 ready photo of page B's b9.
insert into public.media (id, page_id, item_id, kind, state, position, width, height, duration_ms, alt, alt_alt) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'photo', 'ready', 1, 1600, 1200, null, 'A beach', 'Bãi biển'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'video', 'ready', 0, 1280, 720, 4000, null, null),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'photo', 'uploading', 2, null, null, null, null, null),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'photo', 'ready', 0, 800, 600, null, null, null),
  ('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b3', 'photo', 'ready', 0, 800, 600, null, null, null),
  ('00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'photo', 'ready', 3, 640, 480, null, null, null),
  ('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b9', 'photo', 'ready', 0, 800, 600, null, null, null);
insert into public.media_variants (media_id, page_id, variant, bucket, path, mime, bytes, write_until)
select m.id, m.page_id, v, public.media_bucket(v), 'p/' || m.id || '/' || v, 'image/webp', 10, now()
from public.media m cross join unnest('{thumb,display,full}'::public.media_variant[]) v;

-- Home picks: c4 (its memory is a draft: still shown, Q152), c6 and c1, guests in the order c4, c6, c1 (c6 and c1
-- opposite to the draft's), c5 in the draft only.
insert into public.home_picks (item_id, page_id, media_id, position, published_position) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c4', 0, 0),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 1, 3),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c6', 3, 1),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c5', 2, null);

create function pg_temp.ids(variadic n int[]) returns uuid[] language sql as $$
  select array_agg(('00000000-0000-0000-0000-0000000000c' || x)::uuid order by o) from unnest(ids.n) with ordinality t(x, o)
$$;
-- The media ids guest_media admits for token tok, sorted.
create function pg_temp.admitted(tok text, ids uuid[], v public.media_variant) returns uuid[] language sql as $$
  select coalesce(array_agg(g.media_id order by g.media_id), '{}') from public.guest_media(admitted.tok, admitted.ids, admitted.v) g
$$;
-- The helpers live in this session's temp schema; anon needs to reach them.
grant execute on function pg_temp.ids(int[]), pg_temp.admitted(text, uuid[], public.media_variant) to anon;

set local role anon;

-- guest_open: names, time zone, published wording and Home.
select is(public.guest_open('token-a') -> 'names', '["[PARTNER_A]", "[PARTNER_B]"]', 'guest_open returns the partner names');
select is(public.guest_open('token-a') ->> 'timezone', 'Asia/Ho_Chi_Minh', 'guest_open returns the page time zone (E14)');
select is(public.guest_open('token-a') #>> '{copy,home.greeting,en}', 'Welcome to our little corner of the world.',
  'guest_open returns the published wording, not the draft (Q82)');
select is(public.guest_open('token-a') #>> '{copy,home.greeting,vi}', 'Chào mừng bạn đến góc nhỏ của chúng mình.',
  'guest_open returns the wording in both languages');
select is((public.guest_open('token-a') -> 'home') - 'picks',
  '{"lang": "en", "body": "Our note", "lang_alt": "vi", "body_alt": "Lời nhắn", "start_date": "2020-02-29"}',
  'guest_open returns the published Home note and start date');
select is(public.guest_open('token-a') #> '{home,picks}',
  '[{"id": "00000000-0000-0000-0000-0000000000c4", "alt": null, "alt_alt": null, "width": 800, "height": 600},
    {"id": "00000000-0000-0000-0000-0000000000c6", "alt": null, "alt_alt": null, "width": 640, "height": 480},
    {"id": "00000000-0000-0000-0000-0000000000c1", "alt": "A beach", "alt_alt": "Bãi biển", "width": 1600, "height": 1200}]',
  'Home picks: every published pick, also of an unpublished memory (Q152), in published order, not the draft-only one');
select is(public.guest_open('token-a') -> 'sections', '["home", "memories", "together", "guestbook"]', 'guest_open still lists enabled sections only (E5)');

-- guest_list: each row carries its ready media in position order.
select is((select l.media from public.guest_list('token-a', 'memories') l where l.id = '00000000-0000-0000-0000-0000000000b1'),
  '[{"id": "00000000-0000-0000-0000-0000000000c2", "kind": "video", "width": 1280, "height": 720, "duration_ms": 4000, "alt": null, "alt_alt": null},
    {"id": "00000000-0000-0000-0000-0000000000c1", "kind": "photo", "width": 1600, "height": 1200, "duration_ms": null, "alt": "A beach", "alt_alt": "Bãi biển"},
    {"id": "00000000-0000-0000-0000-0000000000c6", "kind": "photo", "width": 640, "height": 480, "duration_ms": null, "alt": null, "alt_alt": null}]',
  'guest_list rows carry their ready media in order, without unfinished uploads');
select is((select l.media from public.guest_list('token-a', 'together') l where l.id = '00000000-0000-0000-0000-0000000000b3') -> 0 ->> 'id',
  '00000000-0000-0000-0000-0000000000c5', 'Together rows carry their media too');

-- guest_item: one published item in an enabled section of the token's page; everything else is the same nothing.
select is((select title from public.guest_item('token-a', '00000000-0000-0000-0000-0000000000b1')), 'Beach', 'guest_item reads a published memory');
select is((select count(*) from public.guest_item('token-a', '00000000-0000-0000-0000-0000000000b2')), 0::bigint, 'guest_item: a draft is not found');
select is((select count(*) from public.guest_item('token-a', '00000000-0000-0000-0000-0000000000b9')), 0::bigint, 'guest_item: another page''s item is not found (E6, E56)');
select is((select count(*) from public.guest_item('token-a', gen_random_uuid())), 0::bigint, 'guest_item: a missing id is not found (E56)');
select is((select count(*) from public.guest_item('token-a', '00000000-0000-0000-0000-0000000000d1')), 0::bigint, 'guest_item: the Home item is read through guest_open only');
select is((select count(*) from public.guest_item('token-a-old', '00000000-0000-0000-0000-0000000000b1')), 0::bigint, 'guest_item: a rotated token reads nothing (E3)');
select is((select count(*) from public.guest_item('token-b', '00000000-0000-0000-0000-0000000000b1')), 0::bigint, 'guest_item: another page''s token reads nothing (E6)');

-- guest_media: only ready media of published items in enabled sections, or shown Home picks.
select is(pg_temp.admitted('token-a', pg_temp.ids(1, 2, 3, 4, 5, 9), 'thumb'), pg_temp.ids(1, 2, 4, 5),
  'guest_media admits ready media of published items and Home picks (a draft memory''s photo only as a pick, Q152; not unfinished or another page''s)');
select is((select g.bucket || ' ' || g.path from public.guest_media('token-a', pg_temp.ids(1), 'display') g),
  'media-display p/00000000-0000-0000-0000-0000000000c1/display', 'guest_media returns the bucket and path of the asked variant');
select is(pg_temp.admitted('token-a', pg_temp.ids(1), 'full'), '{}', 'guest_media never returns the full-size original');
select is(pg_temp.admitted('token-a-old', pg_temp.ids(1), 'thumb'), '{}', 'guest_media: a rotated token gets nothing (E3)');
select is(pg_temp.admitted('token-b', pg_temp.ids(1), 'thumb'), '{}', 'guest_media: another page''s token gets nothing (E6)');
select throws_ok($$select * from public.guest_media('token-a', (select array_agg(gen_random_uuid()) from generate_series(1, 101)), 'thumb')$$,
  '22023', null, 'guest_media refuses more than 100 ids');

-- page_is_live guards every branch: a Private page admits nothing, Home picks included (its wording rule: guest_read).
reset role;
update public.pages set visibility = 'private' where id = '00000000-0000-0000-0000-0000000000a1';
set local role anon;
select is((select count(*) from public.guest_item('token-a', '00000000-0000-0000-0000-0000000000b1')), 0::bigint, 'Private page: guest_item reads nothing (E4)');
select is(pg_temp.admitted('token-a', pg_temp.ids(1, 2, 5), 'thumb'), '{}', 'Private page: guest_media admits nothing, not even a Home pick (E4)');
reset role;
update public.pages set visibility = 'token_only' where id = '00000000-0000-0000-0000-0000000000a1';

reset role;
update public.page_sections set enabled = false where page_id = '00000000-0000-0000-0000-0000000000a1' and section = 'memories';
set local role anon;
select is((select count(*) from public.guest_item('token-a', '00000000-0000-0000-0000-0000000000b1')), 0::bigint,
  'guest_item: an item of a disabled section is not found (E5)');
select is(pg_temp.admitted('token-a', pg_temp.ids(1, 2, 4), 'thumb'), pg_temp.ids(1, 4),
  'Memories disabled: Home picks stay visible, the memory''s other media do not');

reset role;
update public.page_sections set enabled = false where page_id = '00000000-0000-0000-0000-0000000000a1' and section = 'home';
set local role anon;
select is(public.guest_open('token-a') -> 'home', 'null', 'Home section disabled: no Home');
select is(pg_temp.admitted('token-a', pg_temp.ids(1), 'thumb'), '{}', 'Home and Memories disabled: the pick is not admitted');

reset role;
update public.page_sections set enabled = true where page_id = '00000000-0000-0000-0000-0000000000a1' and section = 'home';
update public.items set status = 'draft', published = null where id = '00000000-0000-0000-0000-0000000000d1';
set local role anon;
select is(public.guest_open('token-a') -> 'home', 'null', 'Home unpublished: no Home, the names and wording stay (Q144 default 13)');
select isnt(public.guest_open('token-a') -> 'copy', null, 'Home unpublished: the wording is still returned');

-- Helpers stay out of anon's reach.
select throws_ok($$select public.page_media('00000000-0000-0000-0000-0000000000a1', '{}', 'thumb')$$, '42501', null, 'anon cannot call page_media');
select throws_ok($$select public.get_item('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1')$$, '42501', null, 'anon cannot call get_item');

select * from finish();
rollback;
