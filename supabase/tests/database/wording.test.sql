-- Wording core (T2.7; design 3 §3.12; editable wording §2.1, §2.2; Q82, Q83, Q112, Q114; E12, E15, E33, E55).
-- copy_keys holds the 27 keys and their shipped examples; every new page gets 54 draft rows; copy_validate runs on
-- every write; owner_copy_accept_defaults is the only first publication. Placeholder data only.
begin;
select plan(81);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000f2', 'coeditor@example.test'),
  ('00000000-0000-0000-0000-0000000000f3', 'other-owner@example.test');

create function pg_temp.act_as(id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.page_of(id uuid) returns uuid language sql as $$
  select m.page_id from public.memberships m where m.user_id = page_of.id and m.role = 'owner'
$$;
-- copy_validate on a probe row: 'ok' or the SQLSTATE it raised.
create function pg_temp.verdict(key text, value text) returns text language plpgsql as $$
begin
  perform public.copy_validate(verdict.key, verdict.value);
  return 'ok';
exception when others then
  return sqlstate;
end
$$;

-- The seed equals editable wording §2.1 (the contract): key, cap, allowed and required tokens.
select results_eq($$ select key, max_len::int, allowed_tokens, required_tokens from public.copy_keys order by sort_order $$,
  $$ values
    ('home.greeting', 120, '{partner_a,partner_b}'::text[], '{}'::text[]),
    ('home.days', 120, '{days}', '{days}'),
    ('home.photoHint', 120, '{}', '{}'),
    ('home.scrollCue', 120, '{}', '{}'),
    ('memories.intro', 120, '{count}', '{}'),
    ('memories.empty', 120, '{}', '{}'),
    ('together.intro', 120, '{count}', '{}'),
    ('together.search', 60, '{}', '{}'),
    ('together.empty', 120, '{}', '{}'),
    ('wishes.intro', 120, '{count}', '{}'),
    ('wishes.button', 24, '{}', '{}'),
    ('wishes.empty', 120, '{}', '{}'),
    ('wishes.namePlaceholder', 60, '{}', '{}'),
    ('wishes.messagePlaceholder', 120, '{}', '{}'),
    ('wishes.sent', 60, '{partner_a,partner_b}', '{}'),
    ('wishes.sentBody', 120, '{owner,partner_a,partner_b}', '{}'),
    ('wishes.back', 40, '{}', '{}'),
    ('tour.1.title', 60, '{partner_a,partner_b}', '{}'),
    ('tour.1.body', 200, '{}', '{}'),
    ('tour.2.title', 60, '{}', '{}'),
    ('tour.2.body', 200, '{}', '{}'),
    ('tour.3.title', 60, '{}', '{}'),
    ('tour.3.body', 200, '{}', '{}'),
    ('updates.question', 120, '{}', '{}'),
    ('page.title', 60, '{partner_a,partner_b}', '{}'),
    ('page.description', 120, '{}', '{}'),
    ('email.greeting', 120, '{partner_a,partner_b}', '{}') $$,
  'copy_keys has exactly the 27 keys of editable wording §2.1 (Q83)');
-- Rule 7: every shipped example passes the rules unchanged, so accepting them can never be refused.
select is((select count(*) from public.copy_keys k
    where public.copy_validate(k.key, k.example_en) is not distinct from k.example_en
      and public.copy_validate(k.key, k.example_vi) is not distinct from k.example_vi),
  27::bigint, 'all 54 shipped examples pass copy_validate unchanged (rule 7)');
select is((select example_en || ' / ' || example_vi from public.copy_keys where key = 'wishes.sent'),
  'Wish sent! / Đã gửi lời chúc', 'the owner-approved examples are seeded (2026-11-01)');

-- Who may touch it (design 3 §5, E33).
select ok(not has_table_privilege('anon', 'public.copy_keys', 'select') and not has_table_privilege('authenticated', 'public.copy_keys', 'select')
  and not has_table_privilege('anon', 'public.page_copy', 'select') and not has_table_privilege('authenticated', 'public.page_copy', 'select'),
  'anon and authenticated cannot read copy_keys or page_copy');
select ok(not has_function_privilege('anon', 'public.copy_validate(text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.copy_validate(text, text)', 'execute'),
  'copy_validate is not callable from the API');
select ok(has_function_privilege('authenticated', 'public.owner_copy_accept_defaults(public.visibility)', 'execute')
  and not has_function_privilege('anon', 'public.owner_copy_accept_defaults(public.visibility)', 'execute')
  and not has_function_privilege('vegenus_server', 'public.owner_copy_accept_defaults(public.visibility)', 'execute'),
  'only authenticated can call owner_copy_accept_defaults');

-- Seeding: a new page gets all 54 rows as drafts only (Q112, E55).
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select is(public.owner_save_page(null, 'a_dreamy', 'en', null, null, 'UTC', '{memories}'), 1, 'the owner creates a page');
select is((select count(*) from public.page_copy c where c.page_id = pg_temp.page_of('00000000-0000-0000-0000-0000000000f1')),
  54::bigint, 'the new page has 54 wording rows');
select is((select count(*) from public.page_copy c join public.copy_keys k using (key)
    where c.page_id = pg_temp.page_of('00000000-0000-0000-0000-0000000000f1') and c.published_text is null
      and c.draft_text = case c.lang when 'en' then k.example_en else k.example_vi end),
  54::bigint, 'every draft is the shipped example and nothing is published');
select is((select count(*) from public.page_copy c where c.page_id = pg_temp.page_of('00000000-0000-0000-0000-0000000000f1') and c.version = 1),
  54::bigint, 'every row starts at version 1');
-- A page that is already live when its rows are seeded (test fixtures; pages before this migration) gets the
-- examples published too, so page_is_live never shows a page without its wording.
reset role;
insert into public.pages (id, theme, default_lang, visibility, timezone, copy_published_at)
  values ('00000000-0000-0000-0000-00000000000b', 'b_cosmic', 'en', 'token_only', 'UTC', now());
select is((select count(*) from public.page_copy c
    where c.page_id = '00000000-0000-0000-0000-00000000000b' and c.published_text = c.draft_text),
  54::bigint, 'a page inserted as live gets all 54 examples published');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');

-- Rule 1: trim, NFC, blank means not set.
select is(public.copy_validate('home.scrollCue', '  Scroll down.  '), 'Scroll down.', 'rule 1: surrounding space is trimmed');
select is(public.copy_validate('home.scrollCue', 'Cuo' || U&'\0302\0300' || 'n xuo' || U&'\0301' || 'ng'),
  normalize('Cuo' || U&'\0302\0300' || 'n xuo' || U&'\0301' || 'ng', nfc), 'rule 1: decomposed Vietnamese is stored as NFC (E12)');
select is(public.copy_validate('home.scrollCue', '   '), null, 'rule 1: a blank value means not set');
select is(public.copy_validate('home.scrollCue', null), null, 'rule 1: null stays not set');
-- Rule 2: single line, no control characters (nor the bidi controls the name check refuses).
select is(pg_temp.verdict('home.scrollCue', 'one' || chr(10) || 'two'), '22023', 'rule 2: a line break is refused');
select is(pg_temp.verdict('home.scrollCue', 'tab' || chr(9) || 'here'), '22023', 'rule 2: a tab is refused');
select is(pg_temp.verdict('home.scrollCue', 'del' || chr(127)), '22023', 'rule 2: DEL is refused');
select is(pg_temp.verdict('home.scrollCue', 'abc' || U&'\202E' || 'cba'), '22023', 'rule 2: a bidi override is refused');
select is(pg_temp.verdict('home.scrollCue', 'line' || U&'\2028' || 'two'), '22023', 'rule 2: a Unicode line separator is refused');
select is(pg_temp.verdict('home.scrollCue', 'para' || U&'\2029' || 'two'), '22023', 'rule 2: a Unicode paragraph separator is refused');
-- Rule 3: no markup, no links.
select is(pg_temp.verdict('home.scrollCue', 'a <b>bold</b> move'), '22023', 'rule 3: < and > are refused');
select is(pg_temp.verdict('home.scrollCue', 'see HTTPS://example.test'), '22023', 'rule 3: a link is refused, any case');
select is(pg_temp.verdict('home.scrollCue', 'visit www.example.test'), '22023', 'rule 3: www. is refused');
select is(pg_temp.verdict('home.scrollCue', 'write to mailto:x'), '22023', 'rule 3: mailto: is refused');
select is(pg_temp.verdict('home.scrollCue', 'JavaScript:alert'), '22023', 'rule 3: javascript: is refused');
-- Rule 4: tokens.
select is(pg_temp.verdict('home.days', 'Together for {days} days, {days}!'), 'ok', 'rule 4: a required token may repeat');
select is(pg_temp.verdict('home.days', 'Together for a while.'), '22023', 'rule 4: a missing required token is refused');
select is(pg_temp.verdict('home.days', 'Together for {day} days.'), '22023', 'rule 4: an unknown token is refused');
select is(pg_temp.verdict('home.days', 'Together for {{days} days.'), '22023', 'rule 4: a stray brace is refused');
select is(pg_temp.verdict('home.days', 'Together for {days} days} more.'), '22023', 'rule 4: a lone closing brace is refused');
select is(pg_temp.verdict('home.greeting', 'Hello {days}'), '22023', 'rule 4: a token not allowed for the key is refused');
select is(pg_temp.verdict('home.greeting', 'Hello {Partner_A}'), '22023', 'rule 4: tokens are lowercase only');
-- Rule 5: caps in user-perceived characters; a token counts as its literal text.
select is(pg_temp.verdict('wishes.button', repeat('a', 24)), 'ok', 'rule 5: exactly the cap is accepted');
select is(pg_temp.verdict('wishes.button', repeat('a', 25)), '22023', 'rule 5: one over the cap is refused');
select is(pg_temp.verdict('wishes.button', repeat('a', 23) || U&'\+01F468\200D\+01F469\200D\+01F467'), 'ok',
  'rule 5: a joined emoji counts once');
select is(pg_temp.verdict('wishes.button', repeat('a', 23) || U&'\+01F1FB\+01F1F3'), 'ok', 'rule 5: a flag counts once');
select is(pg_temp.verdict('wishes.button', repeat('ê', 23) || 'e' || U&'\0323\0302'), 'ok',
  'rule 5: an accented Vietnamese letter counts once');
select is(pg_temp.verdict('wishes.button', repeat('a', 24) || U&'\+01F44D\+01F3FD'), '22023', 'rule 5: an emoji past the cap is refused');
select is(pg_temp.verdict('wishes.button', repeat('a', 23) || U&'\+01F469\+01F3FD\200D\+01F4BB'), 'ok',
  'rule 5: an emoji with a skin tone and a joiner counts once');
select is(pg_temp.verdict('wishes.button', repeat(U&'\+01F469\+01F3FD\200D\2764\FE0F\200D\+01F48B\200D\+01F468\+01F3FF', 24)), 'ok',
  'rule 5: the cap filled with the longest joined emoji (10 code points each) is accepted');
select is(pg_temp.verdict('wishes.button', repeat(U&'\+01F469\+01F3FD\200D\2764\FE0F\200D\+01F48B\200D\+01F468\+01F3FF', 25)), '22023',
  'rule 5: one long joined emoji over the cap is refused');
select is(pg_temp.verdict('wishes.button', repeat('a', 23) || U&'\+01F408\200D\2B1B'), 'ok', 'rule 5: the black cat emoji counts once');
select is(pg_temp.verdict('wishes.button', repeat('a' || U&'\FE0F\200D\+01F525', 13)), '22023',
  'rule 5: a joiner after a letter does not fold the next emoji (26 characters)');
select is(pg_temp.verdict('wishes.button', repeat(U&'\+01F1FB\200D\+01F525', 13)), '22023',
  'rule 5: a joiner after a flag letter does not fold the next emoji (26 characters)');
select is(pg_temp.verdict('wishes.button', repeat(U&'\+01F469\FE0F\+01F3FD\200D\+01F4BB', 24)), 'ok',
  'rule 5: an emoji with a variation selector and a skin tone before the joiner counts once');
select is(pg_temp.verdict('wishes.button', repeat(U&'\+01F1FB\200D\+01F1F3' || 'a', 9)), '22023',
  'rule 5: flag letters split by a joiner are not a flag (27 characters)');
select is(pg_temp.verdict('wishes.button', repeat(U&'\2B00\200D\2B00', 13)), '22023',
  'rule 5: joined plain arrows are not an emoji (26 characters)');
select is(pg_temp.verdict('wishes.button', repeat(U&'\2780\200D\2780', 13)), '22023',
  'rule 5: joined circled digits are not an emoji (26 characters)');
select is(pg_temp.verdict('wishes.button', repeat(U&'\200D' || 'a', 30)), '22023', 'rule 5: joiners before letters do not hide them');
select is(pg_temp.verdict('wishes.button', U&'\200D' || repeat('a', 24)), '22023', 'rule 5: a leading joiner does not hide a letter');
select is(pg_temp.verdict('wishes.button', 'a' || repeat(U&'\0301', 500)), '22023', 'rule 5: a pile of combining marks is refused');
select is(pg_temp.verdict('no.such.key', 'text'), '22023', 'an unknown key is refused');

-- The trigger validates every write, the published text too, and moves the version on (design 3 §1.6).
reset role;
select throws_ok($$ update public.page_copy set draft_text = 'Together for a while.'
    where page_id = (select page_id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000f1') and key = 'home.days' and lang = 'en' $$,
  '22023', null, 'a direct write of an invalid draft is refused');
select throws_ok($$ update public.page_copy set published_text = '<script>'
    where page_id = (select page_id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000f1') and key = 'home.days' and lang = 'en' $$,
  '22023', null, 'a direct write of an invalid published text is refused');
update public.page_copy set draft_text = '  Scroll ' || 'xuo' || U&'\0301' || 'ng.  '
  where page_id = pg_temp.page_of('00000000-0000-0000-0000-0000000000f1') and key = 'home.scrollCue' and lang = 'vi';
select is((select draft_text || '|' || version from public.page_copy
    where page_id = pg_temp.page_of('00000000-0000-0000-0000-0000000000f1') and key = 'home.scrollCue' and lang = 'vi'),
  'Scroll xuóng.|2', 'a write is stored trimmed and NFC and moves the version on');

-- The pages invariant (design 3 §3.12, §9): no direct update shows a page before its first wording publication,
-- or picks a default language whose published snapshot is incomplete.
reset role;
select throws_ok($$ update public.pages set visibility = 'token_only'
    where id = (select page_id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000f1') $$,
  '55000', null, 'a direct update cannot show a page whose wording is unpublished');
update public.page_copy set published_text = null
  where page_id = '00000000-0000-0000-0000-00000000000b' and key = 'home.days' and lang = 'vi';
select throws_ok($$ update public.pages set default_lang = 'vi' where id = '00000000-0000-0000-0000-00000000000b' $$,
  '55000', null, 'a direct update cannot pick a default language with an incomplete published snapshot');
select lives_ok($$ update public.pages set default_lang = 'en', theme = 'c_cozy' where id = '00000000-0000-0000-0000-00000000000b' $$,
  'a page with a complete default language can still be updated');
select throws_ok($$ update public.page_copy set published_text = null
    where page_id = '00000000-0000-0000-0000-00000000000b' and key = 'home.days' and lang = 'en' $$,
  '55000', null, 'the published default language of a published page cannot lose a text');
select throws_ok($$ update public.page_copy set published_text = '   '
    where page_id = '00000000-0000-0000-0000-00000000000b' and key = 'home.days' and lang = 'en' $$,
  '55000', null, 'a blank published default-language text is refused too (validated before the guard)');
select throws_ok($$ update public.page_copy set lang = 'vi'
    where page_id = '00000000-0000-0000-0000-00000000000b' and key = 'home.greeting' and lang = 'en' $$,
  '55000', null, 'a wording row cannot move to another key, language or page');
select throws_ok($$ delete from public.page_copy
    where page_id = '00000000-0000-0000-0000-00000000000b' and key = 'home.greeting' and lang = 'vi' $$,
  '55000', null, 'a wording row cannot be deleted while its page exists');
select lives_ok($$ delete from public.pages where id = '00000000-0000-0000-0000-00000000000b' $$,
  'deleting the page still removes its wording');
select is((select count(*) from public.page_copy where page_id = '00000000-0000-0000-0000-00000000000b'), 0::bigint,
  'no wording row outlives its page');
select lives_ok($$ update public.pages set visibility = 'private'
    where id = (select page_id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000f1') $$,
  'an unpublished page can stay Private');

-- Accepting the suggested wording (O3 Finish; Q114).
select set_config('request.jwt.claims', '', true);
select throws_ok($$ select public.owner_copy_accept_defaults('token_only') $$, '42501', null, 'no signed-in user is refused');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f3');
select throws_ok($$ select public.owner_copy_accept_defaults('token_only') $$, '42501', null, 'an account without a page is refused');
reset role;
insert into public.memberships (page_id, user_id, role)
  values (pg_temp.page_of('00000000-0000-0000-0000-0000000000f1'), '00000000-0000-0000-0000-0000000000f2', 'co_editor');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f2');
select throws_ok($$ select public.owner_copy_accept_defaults('token_only') $$, '42501', null, 'a co-editor is refused');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select throws_ok($$ select public.owner_copy_accept_defaults('token_only') $$, '22023', null,
  'Finish needs both partner names (the examples use them)');
select is(public.owner_save_page(2, 'a_dreamy', 'en', 'Partner A', 'Partner B', 'UTC', '{memories}'), 3,
  'the owner sets both names (the Private update above moved the version to 2)');
select throws_ok($$ select public.owner_copy_accept_defaults('published') $$, '22023', null,
  'Finish offers Token-only only (Q114)');
reset role;
update public.page_copy set draft_text = null
  where page_id = pg_temp.page_of('00000000-0000-0000-0000-0000000000f1') and key = 'tour.3.body' and lang = 'vi';
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select throws_ok($$ select public.owner_copy_accept_defaults('token_only') $$, '22023', null, 'an empty key is refused');
reset role;
select ok((select p.visibility = 'private' and p.copy_published_at is null and p.setup_completed_at is null
    and not exists (select 1 from public.page_copy c where c.page_id = p.id and c.published_text is not null)
  from public.pages p where p.id = pg_temp.page_of('00000000-0000-0000-0000-0000000000f1')),
  'a refused Finish publishes nothing and leaves the page Private');
update public.page_copy c set draft_text = k.example_vi from public.copy_keys k
  where c.page_id = pg_temp.page_of('00000000-0000-0000-0000-0000000000f1') and c.key = k.key and c.key = 'tour.3.body' and c.lang = 'vi';

-- A second page, to check Finish touches only the caller's. Names go into wording through tokens, so they are
-- single-line too.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f3');
select throws_ok($$ select public.owner_save_page(null, 'c_cozy', 'vi', 'Partner' || U&'\2028' || 'C', 'Partner D', 'UTC', '{}') $$,
  '23514', null, 'a partner name with a line separator is refused');
select is(public.owner_save_page(null, 'c_cozy', 'vi', 'Partner C', 'Partner D', 'UTC', '{}'), 1, 'another owner creates a page');

reset role;
update public.pages set copy_draft_rev = 3 where id = pg_temp.page_of('00000000-0000-0000-0000-0000000000f1');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select lives_ok($$ select public.owner_copy_accept_defaults('token_only') $$, 'Finish succeeds');
reset role;
select ok((select p.visibility = 'token_only' and p.copy_published_at is not null and p.setup_completed_at is not null
    and p.copy_published_rev = 3
  from public.pages p where p.id = pg_temp.page_of('00000000-0000-0000-0000-0000000000f1')),
  'Finish publishes, sets Token-only and marks setup complete in one step');
select is((select count(*) from public.page_copy c
    where c.page_id = pg_temp.page_of('00000000-0000-0000-0000-0000000000f1') and c.published_text = c.draft_text),
  54::bigint, 'all 54 drafts are published');
select is((select count(*) from public.page_copy c
    where c.page_id = pg_temp.page_of('00000000-0000-0000-0000-0000000000f3') and c.published_text is not null),
  0::bigint, 'the other page is untouched');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select throws_ok($$ select public.owner_copy_accept_defaults('token_only') $$, '55000', null,
  'a second Finish answers already set up and publishes nothing twice (Q114)');

select * from finish();
rollback;
