-- T3.2c: privacy for wishes (privacy design §4.1, §6, §7; PRD Q98, Q164). Each wish records the privacy notice
-- version it consented to and when; a post without consent to the current notice stores and charges nothing; O7 Delete
-- removes a wish at once (unlike Reject, kept 30 days). Wishes reach no real guest before this unit (Q164), so the
-- columns are required from the start.

-- The notice version the site shows (src/lib/privacy.ts holds the same number with its date; the E2E post proves
-- they agree). A change that needs new consent bumps both.
create function public.privacy_notice_version() returns smallint
language sql immutable set search_path = '' as $$ select 1::smallint $$;

alter table public.guestbook_entries
  add column consent_version smallint not null check (consent_version > 0),
  add column consent_at timestamptz not null default now();

drop function public.guest_guestbook_post(text, uuid, bytea, bytea, text, text, public.lang);
drop function public.public_guestbook_post(text, uuid, bytea, bytea, text, text, public.lang);
drop function public.wish_post(text, text, uuid, bytea, bytea, text, text, public.lang);
drop function public.owner_wishes(public.entry_status, timestamptz, uuid);

create function public.wish_post(token text, page_selector text, submission_id uuid, device_key bytea, ip_key bytea,
  display_name text, body text, lang public.lang, consent int) returns jsonb
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
  -- (2b) Consent to the current notice (privacy design §4.1): missing or older stores and charges nothing, like a
  -- replay; the client unticks the box and asks again.
  if wish_post.consent is distinct from public.privacy_notice_version() then
    return '{"status": "needs_consent"}';
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
  insert into public.guestbook_entries (page_id, display_name, body, lang, submission_id, author_kind, token_version, consent_version)
  values (page, name, msg, wish_post.lang, wish_post.submission_id,
    case when wish_post.token is not null then 'token' else 'visitor' end::public.author_kind,
    (select t.version from public.guest_tokens t
      where wish_post.token is not null and t.token_hash = sha256(convert_to(wish_post.token, 'UTF8')) and t.active),
    wish_post.consent);
  return '{"status": "sent"}';
end
$$;

create function public.guest_guestbook_post(token text, submission_id uuid, device_key bytea, ip_key bytea,
  display_name text, body text, lang public.lang, consent int) returns jsonb
language sql security definer set search_path = '' as $$
  select public.wish_post(coalesce(guest_guestbook_post.token, ''), null, guest_guestbook_post.submission_id,
    guest_guestbook_post.device_key, guest_guestbook_post.ip_key, guest_guestbook_post.display_name,
    guest_guestbook_post.body, guest_guestbook_post.lang, guest_guestbook_post.consent)
$$;

create function public.public_guestbook_post(page_selector text, submission_id uuid, device_key bytea, ip_key bytea,
  display_name text, body text, lang public.lang, consent int) returns jsonb
language sql security definer set search_path = '' as $$
  select public.wish_post(null, coalesce(public_guestbook_post.page_selector, ''), public_guestbook_post.submission_id,
    public_guestbook_post.device_key, public_guestbook_post.ip_key, public_guestbook_post.display_name,
    public_guestbook_post.body, public_guestbook_post.lang, public_guestbook_post.consent)
$$;

create function public.owner_wishes(which public.entry_status, after_created_at timestamptz default null, after_id uuid default null)
returns table (id uuid, display_name text, body text, lang public.lang, status public.entry_status,
  author_kind public.author_kind, token_version int, created_at timestamptz, moderated_at timestamptz, consent_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  page uuid := public.owner_page_id();
  queue boolean := owner_wishes.which = 'pending';
begin
  if page is null then
    raise exception 'not the owner of a page' using errcode = '42501';
  end if;
  return query
    select e.id, e.display_name, e.body, e.lang, e.status, e.author_kind, e.token_version, e.created_at, e.moderated_at, e.consent_at
    from public.guestbook_entries e
    where e.page_id = page and e.status = owner_wishes.which
      and (owner_wishes.after_id is null or case when queue
        then (e.created_at, e.id) > (owner_wishes.after_created_at, owner_wishes.after_id)
        else (e.created_at, e.id) < (owner_wishes.after_created_at, owner_wishes.after_id) end)
    order by case when queue then e.created_at end, case when queue then e.id end, e.created_at desc, e.id desc
    limit 50;
end
$$;

-- O7 Delete (privacy design §6): the owner removes a wish of any status at once. Another page's or a missing id is
-- null.
create function public.owner_wish_delete(entry_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  page uuid := public.owner_page_id();
begin
  if page is null then
    raise exception 'not the owner of a page' using errcode = '42501';
  end if;
  delete from public.guestbook_entries e where e.id = owner_wish_delete.entry_id and e.page_id = page;
  return case when found then '{"status": "deleted"}'::jsonb end;
end
$$;

revoke all on function public.privacy_notice_version(), public.wish_post(text, text, uuid, bytea, bytea, text, text, public.lang, int),
  public.guest_guestbook_post(text, uuid, bytea, bytea, text, text, public.lang, int),
  public.public_guestbook_post(text, uuid, bytea, bytea, text, text, public.lang, int),
  public.owner_wishes(public.entry_status, timestamptz, uuid), public.owner_wish_delete(uuid) from public;
grant execute on function public.guest_guestbook_post(text, uuid, bytea, bytea, text, text, public.lang, int),
  public.public_guestbook_post(text, uuid, bytea, bytea, text, text, public.lang, int) to vegenus_server;
grant execute on function public.owner_wishes(public.entry_status, timestamptz, uuid), public.owner_wish_delete(uuid) to authenticated;
