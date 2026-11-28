-- Published address (T3.1p; PRD Q151, Q155-Q157; owner UI "O9 Published address"; design 1 §5.1, §10.2).
-- A Published page opens at /p/<vanity_name>. Every address a page ever held stays reserved for that page forever
-- (owner default 44): page_vanity_names records it, and only the same page may take a retired one back. O9 saves the
-- visibility and the address in one request against the draft's base {visibility, vanity_name, has_link}.

-- The name rule the client and the API apply after trimming and lowercasing (3-40, a-z 0-9, single inner hyphens).
create function public.valid_vanity_name(name text) returns boolean
language sql immutable set search_path = '' as $$
  select char_length(valid_vanity_name.name) between 3 and 40 and valid_vanity_name.name ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
$$;

alter table public.pages add constraint pages_vanity_name_valid
  check (vanity_name is null or public.valid_vanity_name(vanity_name));

create table public.page_vanity_names (
  name text primary key check (public.valid_vanity_name(name)),
  page_id uuid not null references public.pages on delete cascade,
  created_at timestamptz not null default now()
);
create index page_vanity_names_page on public.page_vanity_names (page_id);
alter table public.page_vanity_names enable row level security;

-- Any write of pages.vanity_name reserves it for the page, and refuses a name another page holds or held (23505), so
-- no path around owner_set_visibility can take a retired address.
create function public.reserve_vanity_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.page_vanity_names n where n.name = new.vanity_name and n.page_id <> new.id) then
    raise exception 'the page address is taken' using errcode = '23505';
  end if;
  insert into public.page_vanity_names (name, page_id) values (new.vanity_name, new.id) on conflict (name) do nothing;
  return null;
end
$$;
create trigger reserve_vanity_name after insert or update of vanity_name on public.pages
  for each row when (new.vanity_name is not null) execute function public.reserve_vanity_name();

insert into public.page_vanity_names (name, page_id)
  select p.vanity_name, p.id from public.pages p where p.vanity_name is not null on conflict (name) do nothing;

-- owner_page() carries the address (null until the first publish).
create or replace function public.owner_page() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'version', p.version, 'theme', p.theme, 'default_lang', p.default_lang,
    'label_a', p.label_a, 'label_b', p.label_b, 'timezone', p.timezone,
    'visibility', p.visibility, 'vanity_name', p.vanity_name, 'setup_completed', p.setup_completed_at is not null,
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

-- The O9 save. Under the page lock: a committed request id answers the current snapshot; then the draft's base must
-- still match (else null: conflict, nothing applied); then the wording gate; then apply. Published sets the address
-- (the trigger reserves it or refuses it); Token-only and Private keep the saved address and ignore a sent one.
drop function public.owner_set_visibility(public.visibility, uuid);
-- ponytail: one page per owner (tenancy deferred, Q84); takes a page id when an owner can have several
create function public.owner_set_visibility(visibility public.visibility, vanity_name text, base jsonb, request_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  page uuid;
  saved public.pages;
begin
  if owner_set_visibility.visibility is null or owner_set_visibility.base is null or owner_set_visibility.request_id is null then
    raise exception 'owner_set_visibility needs a visibility, a base and a request id' using errcode = '22023';
  end if;
  if owner_set_visibility.visibility = 'published' and owner_set_visibility.vanity_name is null then
    raise exception 'Published needs a page address' using errcode = '22023';
  end if;
  select m.page_id into page from public.memberships m where m.user_id = auth.uid() and m.role = 'owner';
  if page is null then
    raise exception 'not the owner of a page' using errcode = '42501';
  end if;
  select * into saved from public.pages p where p.id = page for update;
  if exists (select 1 from public.settings_saves s where s.page_id = page and s.kind = 'visibility'
      and s.request_id = owner_set_visibility.request_id) then
    return public.owner_page();
  end if;
  if saved.visibility::text is distinct from owner_set_visibility.base ->> 'visibility'
    or saved.vanity_name is distinct from owner_set_visibility.base ->> 'vanity_name'
    or exists (select 1 from public.guest_tokens t where t.page_id = page and t.active)
      is distinct from (owner_set_visibility.base ->> 'has_link')::boolean then
    return null;
  end if;
  -- A page cannot be shown to guests before its first wording publication (design 3 §3.12).
  if owner_set_visibility.visibility <> 'private' and saved.copy_published_at is null then
    raise exception 'the wording is not published yet' using errcode = '55000';
  end if;
  update public.pages p set visibility = owner_set_visibility.visibility,
    vanity_name = case when owner_set_visibility.visibility = 'published' then owner_set_visibility.vanity_name else p.vanity_name end,
    updated_at = now()
  where p.id = page;
  insert into public.settings_saves (page_id, kind, request_id) values (page, 'visibility', owner_set_visibility.request_id);
  return public.owner_page();
end
$$;

-- G3 and media for a Published page, by its current address only (the guest_item / guest_media rules, Q149).
create function public.public_item(page_selector text, item_id uuid) returns setof public.item_view
language sql stable security definer set search_path = '' as $$
  select * from public.get_item(public.published_page(public_item.page_selector), public_item.item_id)
$$;

create function public.public_media(page_selector text, ids uuid[], variant public.media_variant)
returns table (media_id uuid, bucket text, path text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if cardinality(public_media.ids) > 100 then
    raise exception 'public_media takes at most 100 ids' using errcode = '22023';
  end if;
  return query select * from public.page_media(public.published_page(public_media.page_selector), public_media.ids, public_media.variant);
end
$$;

revoke all on function
  public.valid_vanity_name(text), public.reserve_vanity_name(),
  public.owner_set_visibility(public.visibility, text, jsonb, uuid),
  public.public_item(text, uuid), public.public_media(text, uuid[], public.media_variant)
from public;
grant execute on function public.owner_set_visibility(public.visibility, text, jsonb, uuid) to authenticated;
grant execute on function public.public_item(text, uuid), public.public_media(text, uuid[], public.media_variant) to anon;
