-- T2.6a: what the Share screen O8 and the visibility screen O9 need from the database (owner UI "O8 Share and O9
-- Visibility for T2.6"; PRD Q146 10-44; design 1 §3.2). owner_page() is the one snapshot every O2, O8 and O9 board draws
-- from (Q146 16) and now carries the active link's metadata, never the token. Create and Rotate name the link they
-- expect (Q146 10, 21); O8 acknowledges a revealed version once (Q146 12). The O9 saves record their request id under
-- the page lock, so a retry of a committed save answers the snapshot without applying twice (Q146 20, 35).

-- The request ids of committed O9 saves. Keyed by page and kind, so one page's ids never answer for another's and a
-- visibility save's id never answers for a sections save.
-- shortcut: rows are never pruned (a few per settings change, one page per owner); prune by age if a page ever saves often
create table public.settings_saves (
  page_id uuid not null references public.pages on delete cascade,
  kind text not null check (kind in ('visibility', 'sections')),
  request_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (page_id, kind, request_id)
);

-- ISO 8601 UTC with milliseconds and a Z, whatever the session time zone (Q146 29); O8 formats it in the page zone.
create function public.iso_utc(t timestamptz) returns text
language sql immutable set search_path = '' as $$
  select to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;
alter table public.settings_saves enable row level security;

-- Same signature as before (grants stay); adds `link`: null, or the active version, when it was made and when its
-- reveal was acknowledged (shown_at null: "display not confirmed", Rotate again).
create or replace function public.owner_page() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'version', p.version, 'theme', p.theme, 'default_lang', p.default_lang,
    'label_a', p.label_a, 'label_b', p.label_b, 'timezone', p.timezone,
    'visibility', p.visibility, 'setup_completed', p.setup_completed_at is not null,
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

-- Create (expected_version null: no active link) and Rotate (the active version the owner confirmed). Order (Q146 21):
-- page lock, request id ("already rotated" once that request committed, whatever happened since), expected version
-- ("changed"), then the new token. Answers {token, version} once, or {error}; never the token again.
drop function public.owner_rotate_token(uuid);
-- ponytail: one page per owner (tenancy deferred, Q84); takes a page id when an owner can have several
create function public.owner_rotate_token(request_id uuid, expected_version int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  page uuid;
  token text;
  issued int;
begin
  if owner_rotate_token.request_id is null then
    raise exception 'owner_rotate_token needs a request id' using errcode = '22023';
  end if;
  select m.page_id into page from public.memberships m where m.user_id = auth.uid() and m.role = 'owner';
  if page is null then
    raise exception 'not the owner of a page' using errcode = '42501';
  end if;
  -- Rotations of one page run one after another, so a retry sees the first and two at once leave one active token.
  perform 1 from public.pages p where p.id = page for update;
  if exists (select 1 from public.guest_tokens t where t.request_id = owner_rotate_token.request_id) then
    return jsonb_build_object('error', 'already_rotated');
  end if;
  if (select t.version from public.guest_tokens t where t.page_id = page and t.active)
      is distinct from owner_rotate_token.expected_version then
    return jsonb_build_object('error', 'changed');
  end if;

  token := translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_');
  update public.guest_tokens t set active = false, deactivated_at = now() where t.page_id = page and t.active;
  insert into public.guest_tokens (page_id, version, token_hash, request_id, created_by)
    select page, coalesce(max(t.version), 0) + 1, sha256(convert_to(token, 'UTF8')), owner_rotate_token.request_id, auth.uid()
    from public.guest_tokens t where t.page_id = page
    returning version into issued;
  return jsonb_build_object('token', token, 'version', issued);
end
$$;

-- O8's acknowledgement after a reveal renders: sets shown_at once, only while that version is active. False: the
-- version was replaced (O8 reads the metadata again).
create function public.owner_token_shown(version int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  page uuid;
begin
  if owner_token_shown.version is null then
    raise exception 'owner_token_shown needs a version' using errcode = '22023';
  end if;
  select m.page_id into page from public.memberships m where m.user_id = auth.uid() and m.role = 'owner';
  if page is null then
    raise exception 'not the owner of a page' using errcode = '42501';
  end if;
  update public.guest_tokens t set shown_at = coalesce(t.shown_at, now())
    where t.page_id = page and t.version = owner_token_shown.version and t.active;
  return found;
end
$$;

-- Visibility saves unconditionally (Q146 20) and answers the snapshot. A committed request id answers the current
-- snapshot without applying again (Q146 35).
drop function public.owner_set_visibility(public.visibility);
-- ponytail: one page per owner (tenancy deferred, Q84); takes a page id when an owner can have several
create function public.owner_set_visibility(visibility public.visibility, request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  page uuid;
begin
  if owner_set_visibility.visibility is null or owner_set_visibility.request_id is null then
    raise exception 'owner_set_visibility needs a visibility and a request id' using errcode = '22023';
  end if;
  select m.page_id into page from public.memberships m where m.user_id = auth.uid() and m.role = 'owner';
  if page is null then
    raise exception 'not the owner of a page' using errcode = '42501';
  end if;
  -- Under the page row lock, so the wording check and the change cannot interleave with a publication, and a retry
  -- waits for the first attempt.
  perform 1 from public.pages p where p.id = page for update;
  if exists (select 1 from public.settings_saves s where s.page_id = page and s.kind = 'visibility'
      and s.request_id = owner_set_visibility.request_id) then
    return public.owner_page();
  end if;
  -- A page cannot be shown to guests before its first wording publication (design 3 §3.12).
  if owner_set_visibility.visibility <> 'private'
    and (select p.copy_published_at from public.pages p where p.id = page) is null then
    raise exception 'the wording is not published yet' using errcode = '55000';
  end if;
  update public.pages p set visibility = owner_set_visibility.visibility, updated_at = now() where p.id = page;
  insert into public.settings_saves (page_id, kind, request_id) values (page, 'visibility', owner_set_visibility.request_id);
  return public.owner_page();
end
$$;

-- The sections guests see, for a finished page (before Finish the wizard saves them: owner_save_page). The draft's base
-- flags are the precondition, compared as sets (Q146 20); null answers "conflict" and changes nothing. Home is always on
-- (Q118); zodiac keeps its flag until T3.9 builds it. Turning a section off hides it and deletes nothing.
-- ponytail: one page per owner (tenancy deferred, Q84); takes a page id when an owner can have several
create function public.owner_save_sections(base_sections public.section_id[], sections public.section_id[], request_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  page uuid;
begin
  if owner_save_sections.base_sections is null or owner_save_sections.sections is null
    or owner_save_sections.request_id is null or 'zodiac' = any (owner_save_sections.sections) then
    raise exception 'owner_save_sections needs base flags, flags without zodiac and a request id' using errcode = '22023';
  end if;
  select m.page_id into page from public.memberships m where m.user_id = auth.uid() and m.role = 'owner';
  if page is null then
    raise exception 'not the owner of a page' using errcode = '42501';
  end if;
  perform 1 from public.pages p where p.id = page for update;
  if exists (select 1 from public.settings_saves s where s.page_id = page and s.kind = 'sections'
      and s.request_id = owner_save_sections.request_id) then
    return public.owner_page();
  end if;
  if (select p.setup_completed_at from public.pages p where p.id = page) is null then
    raise exception 'setup is not finished' using errcode = '55000';
  end if;
  if (select array_agg(distinct b order by b) from unnest(owner_save_sections.base_sections) b)
      is distinct from (select array_agg(s.section order by s.section) from public.page_sections s
        where s.page_id = page and s.enabled) then
    return null; -- saved elsewhere since the draft's read
  end if;
  update public.page_sections s
    set enabled = s.section = 'home' or s.section = any (owner_save_sections.sections)
    where s.page_id = page and s.section <> 'zodiac';
  insert into public.settings_saves (page_id, kind, request_id) values (page, 'sections', owner_save_sections.request_id);
  return public.owner_page();
end
$$;

revoke all on function public.iso_utc(timestamptz), public.owner_rotate_token(uuid, int), public.owner_token_shown(int),
  public.owner_set_visibility(public.visibility, uuid),
  public.owner_save_sections(public.section_id[], public.section_id[], uuid) from public;
grant execute on function public.owner_rotate_token(uuid, int), public.owner_token_shown(int),
  public.owner_set_visibility(public.visibility, uuid),
  public.owner_save_sections(public.section_id[], public.section_id[], uuid) to authenticated;
