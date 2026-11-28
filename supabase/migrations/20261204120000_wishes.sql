-- T3.2a: wishes (design 3 §3.5, §3.9, §7; design 1 §6, §10.2; guest UI §8; owner UI O7). E11, E46, E47.
-- Posting is a write without a verified identity, so only vegenus_server may call it, with the device and IP keys our
-- server computes as HMACs (no raw IP or device id reaches the database). Inside one transaction under the page row
-- lock: authorize, answer a stored submission's first result (Q73), charge three buckets (Q75, Q78: 3 per device and
-- 20 per IP over a rolling 24 h from the window's first wish, 50 per page per local day) where any bucket over its
-- limit undoes all three, then store the wish pending. The Member path (account_guestbook_post) comes with guest
-- accounts in T3.6.

-- Q73: the user-perceived length the wording check counted inline, moved here unchanged so wishes count the same way.
create function public.perceived_length(t text) returns int
language plpgsql immutable set search_path = '' as $$
declare
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
  -- shortcut: approximates user-perceived characters (Q73) by folding joined emoji, combining marks, variation
  -- selectors, skin tones, tags and flag pairs; use a real grapheme segmenter if Postgres ever offers one.
  -- A joiner folds the next emoji only after an emoji (optionally with U+FE0F and skin tones), as a grapheme
  -- segmenter does; any other joiner joins the character before it.
  -- Flag letters pair before the other joiners go, so a joiner between two of them keeps them apart.
  return char_length(regexp_replace(regexp_replace(regexp_replace(regexp_replace(t,
    '(?<=[' || ep || '][\ufe0f\U0001f3fb-\U0001f3ff]*)\u200d[' || ep || ']', '', 'g'),
    '[\U0001f1e6-\U0001f1ff]{2}', 'x', 'g'),
    '(?<=.)[\u200c\u200d]', '', 'g'),
    '[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe00-\ufe0f\ufe20-\ufe2f\U0001f3fb-\U0001f3ff\U000e0020-\U000e007f]', '', 'g'));
end
$$;

-- Editable wording §2.2, unchanged apart from counting through perceived_length.
create or replace function public.copy_validate(key text, value text) returns text
language plpgsql stable set search_path = '' as $$
declare
  k public.copy_keys;
  t text;
  tokens text[];
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
  -- The longest joined emoji is 10 code points, so 10 per allowed character bound the stored size without refusing
  -- valid text.
  if char_length(t) > 10 * k.max_len or public.perceived_length(t) > k.max_len then
    raise exception 'wording is longer than its cap' using errcode = '22023';
  end if;
  return t;
end
$$;

-- The wish text (Q34c, Q73): trimmed, NFC, required, at most cap user-perceived characters (10 code points per allowed
-- character bound the stored size, as for wording); a message keeps its line breaks (\r\n stored as \n), a name is
-- one line; no other control, bidi or separator characters (the wording check's set).
create function public.wish_text(value text, cap int, lines boolean) returns text
language plpgsql immutable set search_path = '' as $$
declare
  -- The edges trimmed: JavaScript's \s (what the client's trim() removes), spelled out so the database locale
  -- (whose \s may or may not include Unicode spaces) cannot change it.
  edges constant text := '^[\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+|[\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+$';
  t text := regexp_replace(normalize(regexp_replace(coalesce(wish_text.value, ''), '\r\n?', E'\n', 'g'), nfc), edges, '', 'g');
begin
  if t = '' or char_length(t) > 10 * wish_text.cap or public.perceived_length(t) > wish_text.cap
    or regexp_replace(t, case when wish_text.lines then '\n' else '^$' end, '', 'g')
      ~ '[\x01-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\u2028\u2029]' then
    raise exception 'a wish needs a name and a message within their limits' using errcode = '22023';
  end if;
  return t;
end
$$;

-- The table checks follow (the code-point bound is the size limit; wish_text enforces the perceived caps).
alter table public.guestbook_entries
  drop constraint guestbook_entries_display_name_check,
  drop constraint guestbook_entries_body_check,
  add constraint guestbook_entries_display_name_check check (display_name is nfc normalized and char_length(display_name) between 1 and 400),
  add constraint guestbook_entries_body_check check (body is nfc normalized and char_length(body) between 1 and 5000);

-- A rolling 24-hour bucket (Q75): the window starts at its first hit and ends 24 hours later. Serialized per key, so
-- one device or IP posting on two pages at once cannot open two windows.
create function public.wish_bucket(scope text, key bytea, out hits int, out ends timestamptz)
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(wish_bucket.scope || encode(wish_bucket.key, 'hex'), 0));
  delete from public.rate_limit_hits h
    where h.scope = wish_bucket.scope and h.key_hash = wish_bucket.key and h.window_start <= now() - interval '24 hours';
  update public.rate_limit_hits h set count = h.count + 1
    where h.scope = wish_bucket.scope and h.key_hash = wish_bucket.key
    returning h.count, h.window_start + interval '24 hours' into hits, ends;
  if not found then
    insert into public.rate_limit_hits (scope, key_hash, window_start) values (wish_bucket.scope, wish_bucket.key, now());
    hits := 1;
    ends := now() + interval '24 hours';
  end if;
end
$$;

-- The page's local day around an instant (Q75: 50 a page a day): midnight to midnight in its zone, so a day is 23
-- or 25 hours long when the clocks change.
create function public.wish_day(at timestamptz, tz text, out day_start timestamptz, out day_end timestamptz)
language sql stable set search_path = '' as $$
  select date_trunc('day', at at time zone tz) at time zone tz, (date_trunc('day', at at time zone tz) + interval '1 day') at time zone tz
$$;

-- Both posting paths: exactly one of token and page_selector names the page. Null is the one not-available answer.
create function public.wish_post(token text, page_selector text, submission_id uuid, device_key bytea, ip_key bytea,
  display_name text, body text, lang public.lang) returns jsonb
language plpgsql set search_path = '' as $$
declare
  name text := public.wish_text(wish_post.display_name, 40, false);
  msg text := public.wish_text(wish_post.body, 500, true);
  page uuid;
  tz text;
  day_start timestamptz;
  day_end timestamptz;
  page_key bytea;
  d record;
  i record;
  page_hits int;
  wait timestamptz;
  shared boolean;
begin
  if octet_length(wish_post.device_key) is distinct from 32 or octet_length(wish_post.ip_key) is distinct from 32
    or wish_post.submission_id is null or wish_post.lang is null then
    raise exception 'a wish needs a submission id, a language and two 32-byte keys' using errcode = '22023';
  end if;
  -- (1) The page, locked, then named again under the lock, so a rotation, a visibility change or Wishes turned off
  -- that committed meanwhile wins, also over a stored submission (design 3 §3.9).
  page := case when wish_post.token is not null then public.token_page(wish_post.token) else public.published_page(wish_post.page_selector) end;
  if page is null then
    return null;
  end if;
  select p.timezone into tz from public.pages p where p.id = page for update;
  if page is distinct from (case when wish_post.token is not null then public.token_page(wish_post.token)
      else public.published_page(wish_post.page_selector) end)
    or not public.page_is_live(page, 'guestbook') then
    return null;
  end if;
  -- (2) A stored submission answers its first result and charges nothing (Q73).
  if exists (select 1 from public.guestbook_entries e where e.page_id = page and e.submission_id = wish_post.submission_id) then
    return '{"status": "sent"}';
  end if;
  -- (3) Any bucket over its limit undoes all three and answers the latest expiry among the exceeded ones.
  select w.day_start, w.day_end into day_start, day_end from public.wish_day(now(), tz) w;
  page_key := sha256(uuid_send(page));
  begin
    select * into d from public.wish_bucket('wish_device', wish_post.device_key);
    select * into i from public.wish_bucket('wish_ip', wish_post.ip_key);
    delete from public.rate_limit_hits h where h.scope = 'wish_page' and h.key_hash = page_key and h.window_start < day_start;
    insert into public.rate_limit_hits as h (scope, key_hash, window_start) values ('wish_page', page_key, day_start)
      on conflict (scope, key_hash, window_start) do update set count = h.count + 1
      returning h.count into page_hits;
    if d.hits > 3 or i.hits > 20 or page_hits > 50 then
      wait := greatest(case when d.hits > 3 then d.ends end, case when i.hits > 20 then i.ends end,
        case when page_hits > 50 then day_end end);
      shared := i.hits > 20;
      raise exception 'rate limited' using errcode = 'VG429';
    end if;
  exception when sqlstate 'VG429' then
    return jsonb_build_object('status', 'rate_limited', 'retry_after', ceil(extract(epoch from wait - now()))::int, 'shared', shared);
  end;
  -- (4) Stored pending; a token wish keeps its link version (design 1 §6).
  insert into public.guestbook_entries (page_id, display_name, body, lang, submission_id, author_kind, token_version)
  values (page, name, msg, wish_post.lang, wish_post.submission_id,
    case when wish_post.token is not null then 'token' else 'visitor' end::public.author_kind,
    (select t.version from public.guest_tokens t
      where wish_post.token is not null and t.token_hash = sha256(convert_to(wish_post.token, 'UTF8')) and t.active));
  return '{"status": "sent"}';
end
$$;

create function public.guest_guestbook_post(token text, submission_id uuid, device_key bytea, ip_key bytea,
  display_name text, body text, lang public.lang) returns jsonb
language sql security definer set search_path = '' as $$
  select public.wish_post(coalesce(guest_guestbook_post.token, ''), null, guest_guestbook_post.submission_id,
    guest_guestbook_post.device_key, guest_guestbook_post.ip_key, guest_guestbook_post.display_name,
    guest_guestbook_post.body, guest_guestbook_post.lang)
$$;

create function public.public_guestbook_post(page_selector text, submission_id uuid, device_key bytea, ip_key bytea,
  display_name text, body text, lang public.lang) returns jsonb
language sql security definer set search_path = '' as $$
  select public.wish_post(null, coalesce(public_guestbook_post.page_selector, ''), public_guestbook_post.submission_id,
    public_guestbook_post.device_key, public_guestbook_post.ip_key, public_guestbook_post.display_name,
    public_guestbook_post.body, public_guestbook_post.lang)
$$;

-- O7: the page's wishes with one status, 50 at a time. The queue (pending) oldest first, the history newest first;
-- the keyset cursor (created_at, id) runs in the same direction.
create function public.owner_wishes(which public.entry_status, after_created_at timestamptz default null, after_id uuid default null)
returns table (id uuid, display_name text, body text, lang public.lang, status public.entry_status,
  author_kind public.author_kind, token_version int, created_at timestamptz, moderated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  page uuid := public.owner_page_id();
  queue boolean := owner_wishes.which = 'pending';
begin
  if page is null then
    raise exception 'not the owner of a page' using errcode = '42501';
  end if;
  return query
    select e.id, e.display_name, e.body, e.lang, e.status, e.author_kind, e.token_version, e.created_at, e.moderated_at
    from public.guestbook_entries e
    where e.page_id = page and e.status = owner_wishes.which
      and (owner_wishes.after_id is null or case when queue
        then (e.created_at, e.id) > (owner_wishes.after_created_at, owner_wishes.after_id)
        else (e.created_at, e.id) < (owner_wishes.after_created_at, owner_wishes.after_id) end)
    order by case when queue then e.created_at end, case when queue then e.id end, e.created_at desc, e.id desc
    limit 50;
end
$$;

-- O7 Approve and Reject. expected is the status the owner's screen showed: a different one is "changed" (another tab
-- decided first). Nothing goes back to pending; another page's or a missing id is null.
create function public.owner_wish_moderate(entry_id uuid, status public.entry_status, expected public.entry_status) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  page uuid := public.owner_page_id();
  was public.entry_status;
begin
  if page is null then
    raise exception 'not the owner of a page' using errcode = '42501';
  end if;
  if owner_wish_moderate.entry_id is null or owner_wish_moderate.expected is null
    or owner_wish_moderate.status is null or owner_wish_moderate.status = 'pending'
    or owner_wish_moderate.status = owner_wish_moderate.expected then
    raise exception 'owner_wish_moderate needs an entry, approved or rejected, and the status it replaces' using errcode = '22023';
  end if;
  select e.status into was from public.guestbook_entries e
    where e.id = owner_wish_moderate.entry_id and e.page_id = page for update;
  if not found then
    return null;
  end if;
  if was is distinct from owner_wish_moderate.expected then
    return '{"error": "changed"}';
  end if;
  update public.guestbook_entries e set status = owner_wish_moderate.status, moderated_at = now(), moderated_by = auth.uid()
    where e.id = owner_wish_moderate.entry_id;
  return jsonb_build_object('status', owner_wish_moderate.status);
end
$$;

-- Retention (Q45, design 3 §7): rejected wishes 30 days after the decision; wish buckets as soon as they end (a device
-- or IP window 24 hours after its first wish, a page day within 25). Run by the daily job.
create function public.worker_purge_wishes() returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  delete from public.guestbook_entries e where e.status = 'rejected' and e.moderated_at < now() - interval '30 days';
  get diagnostics n = row_count;
  delete from public.rate_limit_hits h
    where (h.scope in ('wish_device', 'wish_ip') and h.window_start <= now() - interval '24 hours')
       or (h.scope = 'wish_page' and h.window_start < now() - interval '25 hours');
  return n;
end
$$;

-- O2: the pending count.
create or replace function public.owner_page() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'version', p.version, 'theme', p.theme, 'default_lang', p.default_lang,
    'label_a', p.label_a, 'label_b', p.label_b, 'timezone', p.timezone,
    'visibility', p.visibility, 'vanity_name', p.vanity_name, 'setup_completed', p.setup_completed_at is not null,
    'pending_wishes', (select count(*) from public.guestbook_entries e where e.page_id = p.id and e.status = 'pending'),
    'sections', coalesce((
      select jsonb_agg(s.section order by s.sort_order) from public.page_sections s
      where s.page_id = p.id and s.enabled), '[]'::jsonb),
    'storage_used_bytes', public.storage_used(p.id), 'storage_budget_bytes', p.storage_budget_bytes,
    'link', (
      select jsonb_build_object('version', t.version, 'created_at', public.iso_utc(t.created_at),
        'shown_at', public.iso_utc(t.shown_at))
      from public.guest_tokens t where t.page_id = p.id and t.active))
  from public.memberships m join public.pages p on p.id = m.page_id
  where m.user_id = auth.uid() and m.role = 'owner'
$$;

revoke all on function public.perceived_length(text), public.wish_text(text, int, boolean), public.wish_bucket(text, bytea), public.wish_day(timestamptz, text),
  public.wish_post(text, text, uuid, bytea, bytea, text, text, public.lang),
  public.guest_guestbook_post(text, uuid, bytea, bytea, text, text, public.lang),
  public.public_guestbook_post(text, uuid, bytea, bytea, text, text, public.lang),
  public.owner_wishes(public.entry_status, timestamptz, uuid), public.owner_wish_moderate(uuid, public.entry_status, public.entry_status),
  public.worker_purge_wishes() from public;
grant execute on function public.guest_guestbook_post(text, uuid, bytea, bytea, text, text, public.lang),
  public.public_guestbook_post(text, uuid, bytea, bytea, text, text, public.lang), public.worker_purge_wishes() to vegenus_server;
grant execute on function public.owner_wishes(public.entry_status, timestamptz, uuid),
  public.owner_wish_moderate(uuid, public.entry_status, public.entry_status) to authenticated;
