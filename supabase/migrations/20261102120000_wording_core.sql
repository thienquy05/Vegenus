-- T2.7: wording core (design 3 §3.12; editable wording §2.1, §2.2; Q82, Q83, Q112, Q114; E12, E15, E55).
-- copy_keys holds the 27 keys with their caps, tokens and shipped examples (Q112: in the database, so the page
-- trigger can seed them). Every page gets 54 page_copy rows as drafts only; copy_validate checks every write.
-- owner_copy_accept_defaults (O3 Finish) is the only first publication: guests see nothing before it (page_is_live).

create table public.copy_keys (
  key text primary key,
  group_id text not null,
  sort_order smallint not null unique,
  max_len smallint not null check (max_len > 0),
  allowed_tokens text[] not null default '{}',
  required_tokens text[] not null default '{}' check (required_tokens <@ allowed_tokens),
  example_en text not null,
  example_vi text not null
);

-- Editable wording §2.1 (the contract) and §3 (examples; the 11 missing ones approved by the owner 2026-11-01).
insert into public.copy_keys (sort_order, key, group_id, max_len, allowed_tokens, required_tokens, example_en, example_vi) values
  (1, 'home.greeting', 'home', 120, '{partner_a,partner_b}', '{}',
    'Welcome to our little corner of the world.', 'Chào mừng bạn đến góc nhỏ của chúng mình.'),
  (2, 'home.days', 'home', 120, '{days}', '{days}',
    'Together for {days} days and counting.', 'Bên nhau {days} ngày và còn tiếp.'),
  (3, 'home.photoHint', 'home', 120, '{}', '{}',
    'Tap a photo to see the next one.', 'Chạm vào ảnh để xem ảnh tiếp theo.'),
  (4, 'home.scrollCue', 'home', 120, '{}', '{}',
    'Scroll to read our note.', 'Cuộn xuống để đọc lời nhắn.'),
  (5, 'memories.intro', 'memories', 120, '{count}', '{}',
    'Moments we want to keep.', 'Những khoảnh khắc mình muốn giữ lại.'),
  (6, 'memories.empty', 'memories', 120, '{}', '{}',
    'Our first memory is coming soon.', 'Kỷ niệm đầu tiên sắp được thêm vào.'),
  (7, 'together.intro', 'together', 120, '{count}', '{}',
    'Every pin is a place that means something to us.', 'Mỗi chiếc ghim là một nơi có ý nghĩa với chúng mình.'),
  (8, 'together.search', 'together', 60, '{}', '{}',
    'Find one of our places', 'Tìm một nơi của mình'),
  (9, 'together.empty', 'together', 120, '{}', '{}',
    'We haven''t pinned any places yet.', 'Mình chưa ghim nơi nào cả.'),
  (10, 'wishes.intro', 'wishes', 120, '{count}', '{}',
    'Leave us a few words, we read every one.', 'Hãy để lại đôi lời, tụi mình đọc hết nhé.'),
  (11, 'wishes.button', 'wishes', 24, '{}', '{}',
    'Write to us', 'Viết cho tụi mình'),
  (12, 'wishes.empty', 'wishes', 120, '{}', '{}',
    'Be the first to write to us.', 'Hãy là người đầu tiên viết cho tụi mình.'),
  (13, 'wishes.namePlaceholder', 'wishes', 60, '{}', '{}',
    'How should we call you?', 'Tụi mình gọi bạn là gì nhỉ?'),
  (14, 'wishes.messagePlaceholder', 'wishes', 120, '{}', '{}',
    'Say something kind, funny or both.', 'Viết điều gì đó dễ thương hoặc vui vui nhé.'),
  (15, 'wishes.sent', 'wishes', 60, '{partner_a,partner_b}', '{}',
    'Wish sent!', 'Đã gửi lời chúc'),
  (16, 'wishes.sentBody', 'wishes', 120, '{owner,partner_a,partner_b}', '{}',
    'Thank you! {owner} will read it soon.', 'Cảm ơn bạn! {owner} sẽ đọc sớm thôi.'),
  (17, 'wishes.back', 'wishes', 40, '{}', '{}',
    'Back to the wishes', 'Quay lại lời chúc'),
  (18, 'tour.1.title', 'tour', 60, '{partner_a,partner_b}', '{}',
    'Hi, we''re {partner_a} and {partner_b}.', 'Chào bạn, tụi mình là {partner_a} và {partner_b}.'),
  (19, 'tour.1.body', 'tour', 200, '{}', '{}',
    'This is our little corner for the memories we want to keep.',
    'Đây là góc nhỏ tụi mình lưu giữ những kỷ niệm muốn nhớ mãi.'),
  (20, 'tour.2.title', 'tour', 60, '{}', '{}',
    'Look around: memories, places and more.', 'Cứ thong thả xem kỷ niệm, địa điểm và nhiều thứ khác.'),
  (21, 'tour.2.body', 'tour', 200, '{}', '{}',
    'Use the round menu in the corner to move between the parts of our page.',
    'Dùng nút menu tròn ở góc màn hình để đi qua các phần của trang.'),
  (22, 'tour.3.title', 'tour', 60, '{}', '{}',
    'Leave us a few words', 'Gửi tụi mình đôi lời'),
  (23, 'tour.3.body', 'tour', 200, '{}', '{}',
    'If you like, write us a wish. We read every one before it shows here.',
    'Nếu muốn, bạn hãy viết cho tụi mình một lời chúc. Tụi mình đọc từng lời trước khi hiện lên đây.'),
  (24, 'updates.question', 'updates', 120, '{}', '{}',
    'Want a note when we add something new?', 'Muốn nhận tin khi tụi mình thêm điều mới không?'),
  (25, 'page.title', 'page', 60, '{partner_a,partner_b}', '{}',
    '{partner_a} & {partner_b}, our story', '{partner_a} & {partner_b}, câu chuyện của tụi mình'),
  (26, 'page.description', 'page', 120, '{}', '{}',
    'A small place for our memories.', 'Một góc nhỏ lưu giữ kỷ niệm của mình.'),
  (27, 'email.greeting', 'email', 120, '{partner_a,partner_b}', '{}',
    'Hi from {partner_a} and {partner_b},', 'Chào bạn, {partner_a} và {partner_b} gửi tin nhé,');

-- Partner names fill wording through tokens, so they are single-line too (editable wording §2.2 rule 2).
alter table public.pages add constraint pages_labels_single_line
  check (label_a !~ '[\u2028\u2029]' and label_b !~ '[\u2028\u2029]');

create table public.page_copy (
  page_id uuid not null references public.pages on delete cascade,
  key text not null references public.copy_keys,
  lang public.lang not null,
  draft_text text,
  published_text text,
  version int not null default 1,
  updated_at timestamptz not null default now(),
  primary key (page_id, key, lang)
);

alter table public.copy_keys enable row level security;
alter table public.page_copy enable row level security;
revoke all on public.copy_keys, public.page_copy from anon, authenticated;

-- Editable wording §2.2 rules 1 to 5: returns the stored form (trimmed, NFC; null when blank) or raises 22023.
create function public.copy_validate(key text, value text) returns text
language plpgsql stable set search_path = '' as $$
declare
  k public.copy_keys;
  t text;
  tokens text[];
  perceived int;
  -- Unicode 17 Extended_Pictographic, generated from Node's \p{Extended_Pictographic} (the property a grapheme
  -- segmenter joins emoji on; skin tones and flag letters are not in it).
  ep constant text := '\u00a9\u00ae\u203c\u2049\u2122\u2139\u2194-\u2199\u21a9-\u21aa\u231a-\u231b\u2328\u23cf\u23e9-\u23f3'
      || '\u23f8-\u23fa\u24c2\u25aa-\u25ab\u25b6\u25c0\u25fb-\u25fe\u2600-\u2604\u260e\u2611\u2614-\u2615'
      || '\u2618\u261d\u2620\u2622-\u2623\u2626\u262a\u262e-\u262f\u2638-\u263a\u2640\u2642\u2648-\u2653'
      || '\u265f-\u2660\u2663\u2665-\u2666\u2668\u267b\u267e-\u267f\u2692-\u2697\u2699\u269b-\u269c'
      || '\u26a0-\u26a1\u26a7\u26aa-\u26ab\u26b0-\u26b1\u26bd-\u26be\u26c4-\u26c5\u26c8\u26ce-\u26cf\u26d1'
      || '\u26d3-\u26d4\u26e9-\u26ea\u26f0-\u26f5\u26f7-\u26fa\u26fd\u2702\u2705\u2708-\u270d\u270f\u2712'
      || '\u2714\u2716\u271d\u2721\u2728\u2733-\u2734\u2744\u2747\u274c\u274e\u2753-\u2755\u2757\u2763-\u2764'
      || '\u2795-\u2797\u27a1\u27b0\u27bf\u2934-\u2935\u2b05-\u2b07\u2b1b-\u2b1c\u2b50\u2b55\u3030\u303d\u3297'
      || '\u3299\U0001f004\U0001f02c-\U0001f02f\U0001f094-\U0001f09f\U0001f0af-\U0001f0b0\U0001f0c0'
      || '\U0001f0cf-\U0001f0d0\U0001f0f6-\U0001f0ff\U0001f170-\U0001f171\U0001f17e-\U0001f17f\U0001f18e'
      || '\U0001f191-\U0001f19a\U0001f1ae-\U0001f1e5\U0001f201-\U0001f20f\U0001f21a\U0001f22f'
      || '\U0001f232-\U0001f23a\U0001f23c-\U0001f23f\U0001f249-\U0001f25f\U0001f266-\U0001f321'
      || '\U0001f324-\U0001f393\U0001f396-\U0001f397\U0001f399-\U0001f39b\U0001f39e-\U0001f3f0'
      || '\U0001f3f3-\U0001f3f5\U0001f3f7-\U0001f3fa\U0001f400-\U0001f4fd\U0001f4ff-\U0001f53d'
      || '\U0001f549-\U0001f54e\U0001f550-\U0001f567\U0001f56f-\U0001f570\U0001f573-\U0001f57a\U0001f587'
      || '\U0001f58a-\U0001f58d\U0001f590\U0001f595-\U0001f596\U0001f5a4-\U0001f5a5\U0001f5a8'
      || '\U0001f5b1-\U0001f5b2\U0001f5bc\U0001f5c2-\U0001f5c4\U0001f5d1-\U0001f5d3\U0001f5dc-\U0001f5de'
      || '\U0001f5e1\U0001f5e3\U0001f5e8\U0001f5ef\U0001f5f3\U0001f5fa-\U0001f64f\U0001f680-\U0001f6c5'
      || '\U0001f6cb-\U0001f6d2\U0001f6d5-\U0001f6e5\U0001f6e9\U0001f6eb-\U0001f6f0\U0001f6f3-\U0001f6ff'
      || '\U0001f7da-\U0001f7ff\U0001f80c-\U0001f80f\U0001f848-\U0001f84f\U0001f85a-\U0001f85f'
      || '\U0001f888-\U0001f88f\U0001f8ae-\U0001f8af\U0001f8bc-\U0001f8bf\U0001f8c2-\U0001f8cf'
      || '\U0001f8d9-\U0001f8ff\U0001f90c-\U0001f93a\U0001f93c-\U0001f945\U0001f947-\U0001f9ff'
      || '\U0001fa58-\U0001fa5f\U0001fa6e-\U0001faff\U0001fc00-\U0001fffd';
begin
  select * into k from public.copy_keys c where c.key = copy_validate.key;
  if not found then
    raise exception 'unknown wording key' using errcode = '22023';
  end if;
  t := regexp_replace(normalize(copy_validate.value, nfc), '^\s+|\s+$', '', 'g');
  if t is null or t = '' then
    return null;
  end if;
  -- Rule 2, with the C1 and bidi controls the name check refuses too (owner_save_page) and the Unicode line and
  -- paragraph separators.
  if t ~ '[\x01-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\u2028\u2029]' then
    raise exception 'wording is one line with no control characters' using errcode = '22023';
  end if;
  if t ~ '[<>]' or t ~* '(https?://|www\.|mailto:|javascript:)' then
    raise exception 'wording cannot hold markup or links' using errcode = '22023';
  end if;
  if regexp_replace(t, '\{[a-z_]+\}', '', 'g') ~ '[{}]' then
    raise exception 'wording has a malformed token' using errcode = '22023';
  end if;
  tokens := array(select m[1] from regexp_matches(t, '\{([a-z_]+)\}', 'g') m);
  if not tokens <@ k.allowed_tokens or not k.required_tokens <@ tokens then
    raise exception 'wording has a token this text does not allow, or misses a required one' using errcode = '22023';
  end if;
  -- shortcut: approximates user-perceived characters (Q73) by folding joined emoji, combining marks, variation
  -- selectors, skin tones, tags and flag pairs; use a real grapheme segmenter if Postgres ever offers one.
  -- A joiner folds the next emoji only after an emoji (optionally with U+FE0F and skin tones), as a grapheme
  -- segmenter does; any other joiner joins the character before it. The longest joined emoji is 10 code points,
  -- so 10 per allowed character bound the stored size without refusing valid text.
  if char_length(t) > 10 * k.max_len then
    raise exception 'wording is longer than its cap' using errcode = '22023';
  end if;
  -- Flag letters pair before the other joiners go, so a joiner between two of them keeps them apart.
  perceived := char_length(regexp_replace(regexp_replace(regexp_replace(regexp_replace(t,
    '(?<=[' || ep || '][\ufe0f\U0001f3fb-\U0001f3ff]*)\u200d[' || ep || ']', '', 'g'),
    '[\U0001f1e6-\U0001f1ff]{2}', 'x', 'g'),
    '(?<=.)[\u200c\u200d]', '', 'g'),
    '[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe00-\ufe0f\ufe20-\ufe2f\U0001f3fb-\U0001f3ff\U000e0020-\U000e007f]', '', 'g'));
  if perceived > k.max_len then
    raise exception 'wording is longer than its cap' using errcode = '22023';
  end if;
  return t;
end
$$;

create function public.page_copy_validate() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.draft_text := public.copy_validate(new.key, new.draft_text);
  new.published_text := public.copy_validate(new.key, new.published_text);
  return new;
end
$$;

-- A page keeps its 54 rows until it is deleted (cascade: the page row is gone by then), and once its wording is
-- published the default language stays complete in the snapshot (design 3 §3.12), whatever writes the rows.
create function public.page_copy_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.pages p where p.id = old.page_id) then
      raise exception 'wording rows go only with their page' using errcode = '55000';
    end if;
    return old;
  end if;
  if (new.page_id, new.key, new.lang) is distinct from (old.page_id, old.key, old.lang) then
    raise exception 'a wording row keeps its page, key and language' using errcode = '55000';
  end if;
  -- Clearing a published text shares the page row lock, so it waits for a default-language change in flight (and
  -- that change waits for it), and each side then re-reads the other's committed state (Codex round 6).
  if new.published_text is null and old.published_text is not null then
    perform 1 from public.pages p where p.id = new.page_id for share;
  end if;
  if new.published_text is null and old.published_text is not null and exists (
      select 1 from public.pages p
      where p.id = new.page_id and p.copy_published_at is not null and p.default_lang = new.lang) then
    raise exception 'the default language is not complete in the published wording' using errcode = '55000';
  end if;
  return new;
end
$$;

-- Triggers of one kind run in name order: validate first, so the guard sees the stored form (blank becomes null).
create trigger page_copy_1_validate before insert or update on public.page_copy
  for each row execute function public.page_copy_validate();
create trigger page_copy_2_guard before update or delete on public.page_copy
  for each row execute function public.page_copy_guard();
create trigger page_copy_version before update on public.page_copy
  for each row execute function public.bump_version();

-- Every page starts with all 54 rows as drafts only (Q112), so "not set" is never inferred from a missing row.
-- A page already live when seeded (direct inserts, pages from before this migration) gets them published too, so
-- page_is_live never shows a page without its wording.
create function public.seed_page_copy() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into public.page_copy (page_id, key, lang, draft_text, published_text)
  select new.id, k.key, l, e, case when new.copy_published_at is not null then e end
  from public.copy_keys k cross join unnest(enum_range(null::public.lang)) l
  cross join lateral (select case l when 'en' then k.example_en when 'vi' then k.example_vi end) x(e);
  return new;
end
$$;

create trigger pages_seed_copy after insert on public.pages
  for each row execute function public.seed_page_copy();

insert into public.page_copy (page_id, key, lang, draft_text, published_text)
select p.id, k.key, l, e, case when p.copy_published_at is not null then e end
from public.pages p cross join public.copy_keys k cross join unnest(enum_range(null::public.lang)) l
cross join lateral (select case l when 'en' then k.example_en when 'vi' then k.example_vi end) x(e);

-- The pages invariant (design 3 §3.12): whatever writes the row, a page is not shown before its first wording
-- publication, and once published its default language stays complete in the published snapshot. Checked only
-- when those columns change, so a broken page can still be made Private.
create function public.pages_wording_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.visibility <> 'private' and new.copy_published_at is null then
    raise exception 'the wording is not published yet' using errcode = '55000';
  end if;
  if new.copy_published_at is not null
    and (new.default_lang is distinct from old.default_lang or old.copy_published_at is null)
    and (select count(*) from public.page_copy c
         where c.page_id = new.id and c.lang = new.default_lang and c.published_text is not null)
      < (select count(*) from public.copy_keys) then
    raise exception 'the default language is not complete in the published wording' using errcode = '55000';
  end if;
  return new;
end
$$;

create trigger pages_wording_guard before update on public.pages
  for each row execute function public.pages_wording_guard();

-- O3 Finish: publishes every seeded draft, shows the page by token and marks setup complete, all or nothing.
-- Refused once the wording is published, so a retry or a second session publishes nothing twice (Q114).
-- ponytail: one page per owner (tenancy deferred, Q84); takes a page id when an owner can have several
create function public.owner_copy_accept_defaults(visibility public.visibility) returns void
language plpgsql security definer set search_path = '' as $$
declare
  page uuid;
  p public.pages;
begin
  select m.page_id into page from public.memberships m where m.user_id = auth.uid() and m.role = 'owner';
  if page is null then
    raise exception 'not the owner of a page' using errcode = '42501';
  end if;
  -- shortcut: Token-only only (Q114); Published waits for the Phase 3 public route and its O9 confirm.
  if owner_copy_accept_defaults.visibility is distinct from 'token_only' then
    raise exception 'setup finishes as Token-only' using errcode = '22023';
  end if;
  select * into p from public.pages where id = page for update;
  if p.copy_published_at is not null then
    raise exception 'setup is finished' using errcode = '55000';
  end if;
  -- The examples use {partner_a} and {partner_b}, so both names come first (O3 step 2, Q121).
  if p.label_a is null or p.label_b is null then
    raise exception 'both names are needed' using errcode = '22023';
  end if;
  if exists (select 1 from public.page_copy c where c.page_id = page and c.draft_text is null) then
    raise exception 'a wording field is empty' using errcode = '22023';
  end if;
  update public.page_copy c set published_text = c.draft_text where c.page_id = page;
  update public.pages set visibility = owner_copy_accept_defaults.visibility, copy_published_rev = copy_draft_rev,
      copy_published_at = now(), setup_completed_at = now()
    where id = page;
end
$$;

revoke all on function public.copy_validate(text, text), public.page_copy_validate(), public.seed_page_copy(),
  public.pages_wording_guard(), public.page_copy_guard() from public;
revoke all on function public.owner_copy_accept_defaults(public.visibility) from public;
grant execute on function public.owner_copy_accept_defaults(public.visibility) to authenticated;
