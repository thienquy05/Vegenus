-- Wishes (T3.2a; design 3 §3.5, §3.9, §7; design 1 §6, §10.2). E11, E46, E47, Q73, Q75, Q78, Q34d, Q45.
-- Posting runs only as vegenus_server, with HMAC device and IP keys from our server; a refused post charges nothing;
-- a repeated submission_id returns the first result once. The owner moderates (O7). now() is fixed inside this
-- transaction, so time passing is simulated by moving bucket window starts. Placeholder data only.
begin;
select plan(73);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000f2', 'owner-b@example.test');
insert into public.pages (id, theme, default_lang, visibility, timezone, copy_published_at, vanity_name) values
  ('00000000-0000-0000-0000-00000000000a', 'a_dreamy', 'en', 'token_only', 'Asia/Ho_Chi_Minh', now(), 'token-page'),
  ('00000000-0000-0000-0000-00000000000b', 'a_dreamy', 'en', 'published', 'UTC', now(), 'our-page'),
  ('00000000-0000-0000-0000-00000000000c', 'a_dreamy', 'en', 'private', 'UTC', now(), null);
update public.page_sections set enabled = true where section = 'guestbook';
insert into public.memberships (page_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f1', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000f2', 'owner');
insert into public.guest_tokens (page_id, version, token_hash, active, request_id) values
  ('00000000-0000-0000-0000-00000000000a', 1, sha256(convert_to(repeat('O', 43), 'UTF8')), false, gen_random_uuid()),
  ('00000000-0000-0000-0000-00000000000a', 2, sha256(convert_to(repeat('A', 43), 'UTF8')), true, gen_random_uuid()),
  ('00000000-0000-0000-0000-00000000000c', 1, sha256(convert_to(repeat('C', 43), 'UTF8')), true, gen_random_uuid());

create function pg_temp.act_as(id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
$$;
-- A 32-byte key standing in for the server's HMAC of a device or an IP.
create function pg_temp.k(label text) returns bytea language sql as $$ select sha256(convert_to(label, 'UTF8')) $$;
-- The test runs as postgres (it cannot become vegenus_server); the grants are checked below, as in login_limit.
create function pg_temp.post(tok text, sub uuid, dev text, ip text, name text = '[GUEST]', msg text = 'Congratulations') returns jsonb
language sql as $$ select public.guest_guestbook_post(tok, sub, pg_temp.k(dev), pg_temp.k(ip), name, msg, 'en') $$;
create function pg_temp.visit(sel text, sub uuid, dev text, ip text) returns jsonb
language sql as $$ select public.public_guestbook_post(sel, sub, pg_temp.k(dev), pg_temp.k(ip), '[VISITOR]', 'Best wishes', 'vi') $$;
create function pg_temp.hits(scope text, label text) returns int language sql as $$
  select coalesce(sum(count), 0)::int from public.rate_limit_hits where rate_limit_hits.scope = hits.scope and key_hash = pg_temp.k(label)
$$;
create function pg_temp.entries(page uuid) returns bigint language sql as $$
  select count(*) from public.guestbook_entries where page_id = page
$$;

-- Who may call the posting functions (design 3 §3.9, E36).
select throws_ok($$ set local role anon; select public.guest_guestbook_post(repeat('A', 43), gen_random_uuid(), sha256('x'), sha256('y'), 'n', 'm', 'en') $$,
  '42501', null, 'anon cannot call guest_guestbook_post');
reset role;
select throws_ok($$ set local role authenticated; select public.public_guestbook_post('our-page', gen_random_uuid(), sha256('x'), sha256('y'), 'n', 'm', 'en') $$,
  '42501', null, 'authenticated cannot call public_guestbook_post');
reset role;
select ok(has_function_privilege('vegenus_server', 'public.guest_guestbook_post(text, uuid, bytea, bytea, text, text, public.lang)', 'execute')
  and has_function_privilege('vegenus_server', 'public.public_guestbook_post(text, uuid, bytea, bytea, text, text, public.lang)', 'execute'),
  'vegenus_server can call both posting functions');

-- A token wish: pending, labelled with the token version, the text trimmed and NFC (Q73).
select is(pg_temp.post(repeat('A', 43), '00000000-0000-0000-0000-000000000101', 'dev1', 'ip1', '  Lan' || E'e\u0302\u0301' || '  ', 'Hạnh phúc'),
  '{"status": "sent"}'::jsonb, 'a token wish is accepted');
select results_eq($$ select display_name, body, lang::text, status::text, author_kind::text, token_version from public.guestbook_entries
    where submission_id = '00000000-0000-0000-0000-000000000101' $$,
  $$ values (E'Lan\u1ebf', 'Hạnh phúc', 'en', 'pending', 'token', 2) $$,
  'it is stored pending, trimmed and NFC, with the token version (design 1 §6)');
select is(pg_temp.hits('wish_device', 'dev1'), 1, 'the device bucket counts it');
select is(pg_temp.hits('wish_ip', 'ip1'), 1, 'the IP bucket counts it');

-- The same submission again (a lost response, Q73): the first result, one entry, no second charge.
select is(pg_temp.post(repeat('A', 43), '00000000-0000-0000-0000-000000000101', 'dev1', 'ip1'), '{"status": "sent"}'::jsonb,
  'a repeated submission returns the first result');
select is(pg_temp.entries('00000000-0000-0000-0000-00000000000a'), 1::bigint, 'and creates no second entry');
select is(pg_temp.hits('wish_device', 'dev1'), 1, 'and charges the device once');
select is(pg_temp.hits('wish_ip', 'ip1'), 1, 'and charges the IP once');

-- The text rules (Q34c, Q73): required, caps in user-perceived characters, one-line name, no control characters.
select throws_ok($$ select pg_temp.post(repeat('A', 43), gen_random_uuid(), 'dev9', 'ip9', '   ') $$, '22023', null, 'a blank name is refused');
select throws_ok($$ select pg_temp.post(repeat('A', 43), gen_random_uuid(), 'dev9', 'ip9', '[GUEST]', E' \n ') $$, '22023', null, 'a blank wish is refused');
select throws_ok($$ select pg_temp.post(repeat('A', 43), gen_random_uuid(), 'dev9', 'ip9', repeat('n', 41)) $$, '22023', null, 'a 41-character name is refused');
select throws_ok($$ select pg_temp.post(repeat('A', 43), gen_random_uuid(), 'dev9', 'ip9', '[GUEST]', repeat('m', 501)) $$, '22023', null, 'a 501-character wish is refused');
select throws_ok($$ select pg_temp.post(repeat('A', 43), gen_random_uuid(), 'dev9', 'ip9', E'two\nlines') $$, '22023', null, 'a name on two lines is refused');
select throws_ok($$ select pg_temp.post(repeat('A', 43), gen_random_uuid(), 'dev9', 'ip9', '[GUEST]', E'bell\u0007') $$, '22023', null, 'a control character in the wish is refused');
select throws_ok($$ select pg_temp.post(repeat('A', 43), gen_random_uuid(), 'dev9', 'ip9', E'\u202eevil') $$, '22023', null, 'a bidi control in the name is refused');
select throws_ok($$ select public.guest_guestbook_post(repeat('A', 43), gen_random_uuid(), '\x00'::bytea, sha256('y'), 'n', 'm', 'en') $$,
  '22023', null, 'a key that is not a 32-byte HMAC is refused');
select is(pg_temp.hits('wish_device', 'dev9'), 0, 'refused text charges nothing');
select is(pg_temp.post(repeat('A', 43), '00000000-0000-0000-0000-000000000102', 'dev2', 'ip2', repeat(E'\U0001F468\u200d\U0001F469\u200d\U0001F467', 40),
    repeat('ế', 400) || E'\r\n' || repeat(E'\U0001F1FB\U0001F1F3', 99)), '{"status": "sent"}'::jsonb,
  '40 joined emoji fill a name and 500 perceived characters with a line break fill a wish');
select is((select body from public.guestbook_entries where submission_id = '00000000-0000-0000-0000-000000000102'),
  repeat('ế', 400) || E'\n' || repeat(E'\U0001F1FB\U0001F1F3', 99), 'a Windows line break is stored as one newline');

-- Device limit (Q75): 3 per rolling 24 h from the window's first wish; the 4th is refused, charges nothing,
-- and says when to come back.
select is(pg_temp.post(repeat('A', 43), gen_random_uuid(), 'dev1', 'ip3'), '{"status": "sent"}'::jsonb, 'second wish from a device');
select is(pg_temp.post(repeat('A', 43), gen_random_uuid(), 'dev1', 'ip4'), '{"status": "sent"}'::jsonb, 'third wish from a device');
update public.rate_limit_hits set window_start = now() - interval '23 hours' where scope = 'wish_device' and key_hash = pg_temp.k('dev1');
select is(pg_temp.post(repeat('A', 43), '00000000-0000-0000-0000-000000000103', 'dev1', 'ip5'),
  '{"status": "rate_limited", "retry_after": 3600, "shared": false}'::jsonb,
  'the fourth within 24 h is refused until 24 h after the first');
select is(pg_temp.hits('wish_device', 'dev1'), 3, 'the refused wish is not counted on the device');
select is(pg_temp.hits('wish_ip', 'ip5'), 0, 'nor on the IP');
select is((select count(*) from public.guestbook_entries where submission_id = '00000000-0000-0000-0000-000000000103'), 0::bigint, 'nor stored');
update public.rate_limit_hits set window_start = now() - interval '24 hours' where scope = 'wish_device' and key_hash = pg_temp.k('dev1');
select is(pg_temp.post(repeat('A', 43), '00000000-0000-0000-0000-000000000103', 'dev1', 'ip5'), '{"status": "sent"}'::jsonb,
  '24 h after the first wish the window is new');
select is(pg_temp.hits('wish_device', 'dev1'), 1, 'and the new window counts from one');

-- IP limit (Q78): 20 per rolling 24 h across devices, so a venue is not blocked at 3; the 21st is refused as shared.
select is((select count(*) from generate_series(1, 20) n
    where pg_temp.post(repeat('A', 43), gen_random_uuid(), 'crowd' || n, 'venue') = '{"status": "sent"}'::jsonb), 20::bigint,
  '20 devices on one IP each send a wish');
select is(pg_temp.post(repeat('A', 43), gen_random_uuid(), 'crowd21', 'venue'),
  '{"status": "rate_limited", "retry_after": 86400, "shared": true}'::jsonb, 'the 21st on that IP is refused and marked shared');
select is(pg_temp.post(repeat('A', 43), gen_random_uuid(), 'crowd21', 'elsewhere'), '{"status": "sent"}'::jsonb,
  'the same device on another network is fine (it was not charged)');

-- Overlapping device and IP windows: the later expiry wins.
update public.rate_limit_hits set count = 3, window_start = now() - interval '23 hours' where scope = 'wish_device' and key_hash = pg_temp.k('crowd1');
update public.rate_limit_hits set window_start = now() - interval '1 hour' where scope = 'wish_ip' and key_hash = pg_temp.k('venue');
select is(pg_temp.post(repeat('A', 43), gen_random_uuid(), 'crowd1', 'venue'),
  '{"status": "rate_limited", "retry_after": 82800, "shared": true}'::jsonb, 'device and IP both full: the later expiry');

-- The page day in its own zone, at fixed instants: a 25-hour and a 23-hour day across the New York DST changes, and
-- the last second before a Ho Chi Minh City midnight against the first one after.
select is((select row(d.day_start, d.day_end)::text from public.wish_day('2026-11-01 12:00-05', 'America/New_York') d),
  row('2026-11-01 04:00Z'::timestamptz, '2026-11-02 05:00Z'::timestamptz)::text, 'the day DST ends lasts 25 hours');
select is((select row(d.day_start, d.day_end)::text from public.wish_day('2026-03-08 12:00-04', 'America/New_York') d),
  row('2026-03-08 05:00Z'::timestamptz, '2026-03-09 04:00Z'::timestamptz)::text, 'the day DST starts lasts 23 hours');
select is((select row(d.day_start, d.day_end)::text from public.wish_day('2026-11-27 23:59:59+07', 'Asia/Ho_Chi_Minh') d),
  row('2026-11-27 00:00+07'::timestamptz, '2026-11-28 00:00+07'::timestamptz)::text, 'one second before local midnight is still today');
select is((select d.day_start from public.wish_day('2026-11-28 00:00+07', 'Asia/Ho_Chi_Minh') d),
  '2026-11-28 00:00+07'::timestamptz, 'local midnight starts the next day');

-- Page limit: 50 per day in the page's time zone; the wait runs to the next local midnight.
update public.rate_limit_hits set count = 50 where scope = 'wish_page';
select is(pg_temp.post(repeat('A', 43), gen_random_uuid(), 'fresh', 'fresh'),
  jsonb_build_object('status', 'rate_limited', 'shared', false, 'retry_after',
    ceil(extract(epoch from ((date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') + interval '1 day') at time zone 'Asia/Ho_Chi_Minh') - now()))::int),
  'the page full for today: come back at the next local midnight');
select is(pg_temp.hits('wish_device', 'fresh'), 0, 'a page-full refusal charges the device nothing');
delete from public.rate_limit_hits where scope = 'wish_page';

-- Not available (E47, design 1 §6): one answer, nothing charged.
select is(pg_temp.post(repeat('Z', 43), gen_random_uuid(), 'dev7', 'ip7'), null, 'an unknown token');
select is(pg_temp.post(repeat('O', 43), gen_random_uuid(), 'dev7', 'ip7'), null, 'a rotated token is dead for posting (E3)');
select is(pg_temp.post(repeat('C', 43), gen_random_uuid(), 'dev7', 'ip7'), null, 'a Private page');
update public.page_sections set enabled = false where section = 'guestbook' and page_id = '00000000-0000-0000-0000-00000000000a';
select is(pg_temp.post(repeat('A', 43), gen_random_uuid(), 'dev7', 'ip7'), null, 'Wishes turned off');
select is(pg_temp.post(repeat('A', 43), '00000000-0000-0000-0000-000000000101', 'dev7', 'ip7'), null,
  'a replay after access is gone is refused, not answered from the first result');
update public.page_sections set enabled = true where section = 'guestbook' and page_id = '00000000-0000-0000-0000-00000000000a';
select is(pg_temp.hits('wish_device', 'dev7') + pg_temp.hits('wish_ip', 'ip7'), 0, 'refusals charge nothing');

-- A visitor on a Published page (Q78, design 1 §10.2).
select is(pg_temp.visit('our-page', '00000000-0000-0000-0000-000000000201', 'v1', 'vip1'), '{"status": "sent"}'::jsonb, 'a visitor wish on a Published page');
select results_eq($$ select author_kind::text, token_version, lang::text from public.guestbook_entries where submission_id = '00000000-0000-0000-0000-000000000201' $$,
  $$ values ('visitor', null::int, 'vi') $$, 'stored as a visitor wish with no token version');
select is(pg_temp.visit('token-page', gen_random_uuid(), 'v2', 'vip2'), null, 'a Token-only page by its name: not available (E47)');
select is(pg_temp.visit('no-such-page', gen_random_uuid(), 'v2', 'vip2'), null, 'an unknown name: not available');
select is(pg_temp.hits('wish_device', 'v2'), 0, 'and nothing charged');

-- O7: the owner reads and moderates their own page's wishes.
select throws_ok($$ select * from public.owner_wishes('pending') $$, '42501', null, 'no signed-in user cannot list wishes');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select is((select count(*) from public.owner_wishes('pending')), pg_temp.entries('00000000-0000-0000-0000-00000000000a'),
  'the queue holds every pending wish of the page, none of another page');
select is((public.owner_page() ->> 'pending_wishes')::int, pg_temp.entries('00000000-0000-0000-0000-00000000000a')::int, 'O2 gets the pending count');
create temp table first as select id from public.guestbook_entries where submission_id = '00000000-0000-0000-0000-000000000101';
select is(public.owner_wish_moderate((select id from first), 'approved', 'pending'), '{"status": "approved"}'::jsonb, 'approve a pending wish');
select results_eq($$ select display_name from public.guest_guestbook_list(repeat('A', 43)) $$, $$ values (E'Lan\u1ebf') $$,
  'guests now see it, and only it (Q34d)');
select is(public.owner_wish_moderate((select id from first), 'rejected', 'pending'), '{"error": "changed"}'::jsonb,
  'a decision from a stale view is "changed"');
select is(public.owner_wish_moderate((select id from first), 'rejected', 'approved'), '{"status": "rejected"}'::jsonb, 'an approved wish can be rejected later');
select is((select count(*) from public.guest_guestbook_list(repeat('A', 43))), 0::bigint, 'and guests no longer see it');
select throws_ok($$ select public.owner_wish_moderate((select id from first), 'pending', 'rejected') $$, '22023', null, 'nothing goes back to pending');
select is(public.owner_wish_moderate((select id from public.guestbook_entries where submission_id = '00000000-0000-0000-0000-000000000201'), 'approved', 'pending'),
  null, 'another page''s wish is not found');
select results_eq($$ select id, status::text from public.owner_wishes('rejected') $$, $$ select id, 'rejected' from first $$, 'the rejected history');
-- The edges trimmed do not depend on the database locale: exactly JavaScript's \s set, so client and server agree.
select is(public.wish_text(E'\uFEFFx\u2028\u3000\u00A0', 10, true), 'x', 'Unicode white space and a BOM at the edges are trimmed');
select throws_ok($$ select public.wish_text(E'x\u0085', 10, true) $$, '22023', null, 'NEL is not white space here: refused as a control');
select throws_ok($$ select public.owner_wish_moderate((select id from first), 'rejected', 'rejected') $$, '22023', null,
  'a decision equal to the current status is refused (it would restart the purge clock)');

-- O7 order and paging on page b: the queue oldest first, the histories newest first, the (created_at, id) cursor in
-- each direction, ties on created_at broken by id.
insert into public.guestbook_entries (id, page_id, display_name, body, lang, submission_id, author_kind, status, created_at) values
  ('00000000-0000-0000-0000-0000000003b1', '00000000-0000-0000-0000-00000000000b', 'n', 'm', 'en', gen_random_uuid(), 'visitor', 'pending', '2026-01-02'),
  ('00000000-0000-0000-0000-0000000003b2', '00000000-0000-0000-0000-00000000000b', 'n', 'm', 'en', gen_random_uuid(), 'visitor', 'pending', '2026-01-01'),
  ('00000000-0000-0000-0000-0000000003b3', '00000000-0000-0000-0000-00000000000b', 'n', 'm', 'en', gen_random_uuid(), 'visitor', 'pending', '2026-01-01'),
  ('00000000-0000-0000-0000-0000000003b4', '00000000-0000-0000-0000-00000000000b', 'n', 'm', 'en', gen_random_uuid(), 'visitor', 'pending', '2026-01-03'),
  ('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-00000000000b', 'n', 'm', 'en', gen_random_uuid(), 'visitor', 'approved', '2026-01-01'),
  ('00000000-0000-0000-0000-0000000003a2', '00000000-0000-0000-0000-00000000000b', 'n', 'm', 'en', gen_random_uuid(), 'visitor', 'approved', '2026-01-02'),
  ('00000000-0000-0000-0000-0000000003a3', '00000000-0000-0000-0000-00000000000b', 'n', 'm', 'en', gen_random_uuid(), 'visitor', 'approved', '2026-01-02');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f2');
select is(array(select right(id::text, 3) from public.owner_wishes('pending') where id::text like '%3b_'), array['3b2', '3b3', '3b1', '3b4'], 'the queue: oldest first, ties by id');
select is(array(select right(id::text, 3) from public.owner_wishes('pending', '2026-01-01', '00000000-0000-0000-0000-0000000003b2') where id::text like '%3b_'),
  array['3b3', '3b1', '3b4'], 'the queue after a cursor: the rows after it, the tie included');
select is(array(select right(id::text, 3) from public.owner_wishes('approved')), array['3a3', '3a2', '3a1'], 'the history: newest first, ties by id descending');
select is(array(select right(id::text, 3) from public.owner_wishes('approved', '2026-01-02', '00000000-0000-0000-0000-0000000003a3')),
  array['3a2', '3a1'], 'the history after a cursor: the older rows, the tie included');

-- Retention (Q45): rejected wishes go 30 days after the decision; expired wish buckets go too.
select ok(has_function_privilege('vegenus_server', 'public.worker_purge_wishes()', 'execute')
  and not has_function_privilege('authenticated', 'public.worker_purge_wishes()', 'execute'), 'only vegenus_server runs the purge');
update public.guestbook_entries set moderated_at = now() - interval '31 days' where id = (select id from first);
-- Buckets go once expired (design 3 §7 keeps them 24 hours): a device or IP window at 24 hours, a page day after 25.
insert into public.rate_limit_hits (scope, key_hash, window_start, count) values
  ('wish_device', pg_temp.k('old'), now() - interval '24 hours 1 second', 1),
  ('wish_ip', pg_temp.k('young'), now() - interval '23 hours 59 minutes', 1),
  ('wish_page', pg_temp.k('old_day'), now() - interval '25 hours 1 second', 1),
  ('wish_page', pg_temp.k('young_day'), now() - interval '24 hours 30 minutes', 1);
select is(public.worker_purge_wishes(), 1, 'one rejected wish purged');
select ok(not exists (select 1 from public.guestbook_entries where id = (select id from first))
  and pg_temp.hits('wish_device', 'crowd1') = 3, 'it is gone; live buckets stay');
select is(array[pg_temp.hits('wish_device', 'old'), pg_temp.hits('wish_ip', 'young'), pg_temp.hits('wish_page', 'old_day'), pg_temp.hits('wish_page', 'young_day')],
  array[0, 1, 0, 1], 'an expired device window and an ended page day go; windows still running stay');

select * from finish();
rollback;
