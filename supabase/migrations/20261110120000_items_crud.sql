-- T2.2: items CRUD with draft and publish (owner UI O4, O5; design 3 §1.6, §3.3; PRD E15, E6, E33, E56).
-- The owner creates drafts, edits them naming the version they read, publishes and unpublishes, and deletes.
-- A stale version, an id of another page and an id that does not exist all answer the same (null or false), so
-- an id reveals nothing (E56). Home items belong to T2.4 and zodiac items to T3.9, so they are refused here.
-- Publication boundary (design 3 §1 principle 3, §3.10): Publish copies the item's guest-visible fields into
-- `published`, and guests read only that snapshot, so later saves stay invisible until the next Publish.

-- What guests see of an item's content. Order and identity (id, kind, sort_order) are read from the row.
create function public.item_snapshot(i public.items) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('lang', i.lang, 'title', i.title, 'body', i.body, 'lang_alt', i.lang_alt,
    'title_alt', i.title_alt, 'body_alt', i.body_alt, 'event_date', i.event_date, 'date_precision', i.date_precision,
    'recurs_yearly', i.recurs_yearly, 'start_date', i.start_date, 'zodiac_system', i.zodiac_system,
    'zodiac_key', i.zodiac_key)
$$;

alter table public.items add column published jsonb;
update public.items i set published = public.item_snapshot(i) where i.status = 'published';
alter table public.items add constraint items_published_snapshot check ((status = 'published') = (published is not null));

-- Guests read the snapshot, never the working columns (same signature and columns as before).
create or replace function public.list_items(page_id uuid, section public.section_id, after_sort numeric, after_id uuid)
returns setof public.item_view
language sql stable set search_path = '' as $$
  select i.id, i.kind, s.lang, s.title, s.body, s.lang_alt, s.title_alt, s.body_alt,
    s.event_date, s.date_precision, s.recurs_yearly, s.start_date, s.zodiac_system, s.zodiac_key, i.sort_order
  from public.items i
  cross join lateral jsonb_populate_record(null::public.item_view, i.published) s
  where public.page_is_live(list_items.page_id, list_items.section)
    and i.page_id = list_items.page_id and i.section = list_items.section and i.status = 'published'
    and (list_items.after_id is null or (i.sort_order, i.id) > (list_items.after_sort, list_items.after_id))
  order by i.sort_order, i.id
  limit 50
$$;

-- Ids of deleted items, so a delayed create retry cannot bring one back (Codex round 2). No policies: only the
-- owner functions below touch it. ponytail: rows are kept until the page is deleted; a few bytes per deleted item.
create table public.item_tombstones (
  id uuid primary key,
  page_id uuid not null references public.pages on delete cascade
);
alter table public.item_tombstones enable row level security;

-- Overwrite check: every update of an item moves its version on.
create trigger items_version before update on public.items
  for each row execute function public.bump_version();

-- The caller's page, or null. Only an owner has one (a co-editor is reserved, Q35), so the writers refuse null.
create function public.owner_page_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.page_id from public.memberships m where m.user_id = auth.uid() and m.role = 'owner'
$$;

create function public.owner_item_save(
  item_id uuid, expected_version int, kind public.item_kind, lang public.lang, title text, body text,
  lang_alt public.lang, title_alt text, body_alt text, event_date date, date_precision public.date_precision,
  recurs_yearly boolean, remind_owner boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  page uuid := public.owner_page_id();
  found_kind public.item_kind;
  saved int;
  new_id uuid;
begin
  if page is null then
    raise exception 'not allowed to edit items' using errcode = '42501';
  end if;
  if owner_item_save.kind is null or owner_item_save.kind not in ('memory', 'milestone', 'anniversary')
    or owner_item_save.lang is null or owner_item_save.item_id is null then
    raise exception 'owner_item_save needs a memory, milestone or anniversary, a language and an id' using errcode = '22023';
  end if;

  -- A create names no version and carries an id the screen chose, so a retry after a lost answer finds the item it
  -- made instead of making a second one (Codex review of T2.2).
  if owner_item_save.expected_version is null then
    insert into public.items (id, page_id, kind, lang, title, body, lang_alt, title_alt, body_alt, event_date,
        date_precision, recurs_yearly, remind_owner, sort_order, created_by, updated_by)
      values (owner_item_save.item_id, page, owner_item_save.kind, owner_item_save.lang, owner_item_save.title, owner_item_save.body,
        owner_item_save.lang_alt, owner_item_save.title_alt, owner_item_save.body_alt, owner_item_save.event_date,
        owner_item_save.date_precision, coalesce(owner_item_save.recurs_yearly, false),
        coalesce(owner_item_save.remind_owner, false),
        coalesce((select max(o.sort_order) from public.items o where o.page_id = page
          and o.section = case owner_item_save.kind when 'memory' then 'memories' else 'together' end::public.section_id), 0) + 1,
        auth.uid(), auth.uid())
      on conflict (id) do nothing
      returning id, version into new_id, saved;
    -- A deleted id stays deleted (Codex round 2). Checked after the insert: an insert racing the delete waits on
    -- the row and then sees the delete's tombstone, which commits with it.
    if exists (select 1 from public.item_tombstones t where t.id = owner_item_save.item_id) then
      if found then
        delete from public.items i where i.id = new_id;
      end if;
      return null;
    end if;
    if found then
      return jsonb_build_object('id', new_id, 'version', saved);
    end if;
    -- The id exists: a retry answers its item only if it is the same request (same content) and nothing has changed
    -- the item since; anything else, including another page's id, answers like a missing one (E56, Codex round 2).
    perform 1 from public.items i
      where i.id = owner_item_save.item_id and i.page_id = page and i.version = 1 and i.kind = owner_item_save.kind
        and (i.lang, i.title, i.body, i.lang_alt, i.title_alt, i.body_alt, i.event_date, i.date_precision,
          i.recurs_yearly, i.remind_owner)
        is not distinct from (owner_item_save.lang, owner_item_save.title, owner_item_save.body,
          owner_item_save.lang_alt, owner_item_save.title_alt, owner_item_save.body_alt, owner_item_save.event_date,
          owner_item_save.date_precision, coalesce(owner_item_save.recurs_yearly, false),
          coalesce(owner_item_save.remind_owner, false));
    return case when found then jsonb_build_object('id', owner_item_save.item_id, 'version', 1) end;
  end if;

  select i.kind into found_kind from public.items i
    where i.id = owner_item_save.item_id and i.page_id = page and i.version = owner_item_save.expected_version
    for update;
  if not found then
    return null; -- changed elsewhere, gone, or not this page's (E15, E56)
  end if;
  if found_kind <> owner_item_save.kind then
    raise exception 'the kind of an item cannot change' using errcode = '22023';
  end if;
  update public.items i set lang = owner_item_save.lang, title = owner_item_save.title, body = owner_item_save.body,
      lang_alt = owner_item_save.lang_alt, title_alt = owner_item_save.title_alt, body_alt = owner_item_save.body_alt,
      event_date = owner_item_save.event_date, date_precision = owner_item_save.date_precision,
      recurs_yearly = coalesce(owner_item_save.recurs_yearly, false),
      remind_owner = coalesce(owner_item_save.remind_owner, false), updated_by = auth.uid()
    where i.id = owner_item_save.item_id
    returning i.version into saved;
  return jsonb_build_object('id', owner_item_save.item_id, 'version', saved);
end
$$;

-- Publish copies the working fields into the snapshot guests read; unpublish clears it. published_at records the
-- first publication and is kept after an unpublish.
create function public.owner_item_set_status(item_id uuid, expected_version int, status public.pub_status)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  page uuid := public.owner_page_id();
  saved int;
begin
  if page is null then
    raise exception 'not allowed to edit items' using errcode = '42501';
  end if;
  if owner_item_set_status.status is null then
    raise exception 'owner_item_set_status needs a status' using errcode = '22023';
  end if;
  update public.items i set status = owner_item_set_status.status,
      published = case when owner_item_set_status.status = 'published' then public.item_snapshot(i) end,
      published_at = case when owner_item_set_status.status = 'published' then coalesce(i.published_at, now())
        else i.published_at end,
      updated_by = auth.uid()
    where i.id = owner_item_set_status.item_id and i.page_id = page and i.version = owner_item_set_status.expected_version
    returning i.version into saved;
  return saved; -- null: changed elsewhere, gone, or not this page's
end
$$;

create function public.owner_item_delete(item_id uuid, expected_version int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  page uuid := public.owner_page_id();
begin
  if page is null then
    raise exception 'not allowed to edit items' using errcode = '42501';
  end if;
  delete from public.items i
    where i.id = owner_item_delete.item_id and i.page_id = page and i.version = owner_item_delete.expected_version;
  if not found then
    return false;
  end if;
  insert into public.item_tombstones (id, page_id) values (owner_item_delete.item_id, page);
  return true;
end
$$;

-- O4: one section's items, drafts included, without the long text. unpublished_changes: a published item whose
-- working copy differs from what guests see.
create function public.owner_items_list(section public.section_id) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id, 'kind', i.kind, 'status', i.status, 'lang', i.lang, 'title', i.title,
      'event_date', i.event_date, 'date_precision', i.date_precision, 'published_at', i.published_at,
      'unpublished_changes', i.published is not null and i.published is distinct from public.item_snapshot(i),
      'version', i.version) order by i.sort_order, i.id), '[]'::jsonb)
  from public.items i
  where i.page_id = public.owner_page_id() and i.section = owner_items_list.section
$$;

-- O5: one item, or null.
create function public.owner_item_get(item_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(i) - 'page_id' - 'created_by' - 'updated_by'
  from public.items i
  where i.id = owner_item_get.item_id and i.page_id = public.owner_page_id()
$$;

revoke all on function
  public.item_snapshot(public.items),
  public.owner_page_id(),
  public.owner_item_save(uuid, int, public.item_kind, public.lang, text, text, public.lang, text, text, date, public.date_precision, boolean, boolean),
  public.owner_item_set_status(uuid, int, public.pub_status),
  public.owner_item_delete(uuid, int),
  public.owner_items_list(public.section_id),
  public.owner_item_get(uuid)
from public;
grant execute on function
  public.owner_item_save(uuid, int, public.item_kind, public.lang, text, text, public.lang, text, text, date, public.date_precision, boolean, boolean),
  public.owner_item_set_status(uuid, int, public.pub_status),
  public.owner_item_delete(uuid, int),
  public.owner_items_list(public.section_id),
  public.owner_item_get(uuid)
to authenticated;
