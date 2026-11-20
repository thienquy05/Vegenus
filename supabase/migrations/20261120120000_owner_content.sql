-- Owner content read path for O4 and O5 (owner UI "O4 Content list and O5 Item editor"; Q140; design 3 §3.3, §3.4).
-- The list is ordered by date (Memories newest first, Together oldest first; no manual reorder, Q140). The item read
-- carries its finished media with alt text and the file to preview. Alt text is saved with the item under its
-- version (E15), so a stale screen changes neither. The owner may read the files of their own page's media, so the
-- item route can sign preview URLs with the owner's session (no secret key outside the worker).

create or replace function public.owner_items_list(section public.section_id) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id, 'kind', i.kind, 'status', i.status, 'lang', i.lang, 'title', i.title,
      'event_date', i.event_date, 'date_precision', i.date_precision, 'published_at', i.published_at,
      'unpublished_changes', i.published is not null and i.published is distinct from public.item_snapshot(i),
      'version', i.version)
    order by
      case when owner_items_list.section = 'memories' then i.event_date end desc nulls last,
      case when owner_items_list.section = 'memories' then i.sort_order end desc,
      case when owner_items_list.section <> 'memories' then i.event_date end asc nulls last,
      i.sort_order, i.id), '[]'::jsonb)
  from public.items i
  where i.page_id = public.owner_page_id() and i.section = owner_items_list.section
$$;

-- O5: one item with its finished media (an unfinished upload is O6's business), or null. preview names the file the
-- screen shows: a photo's thumbnail, a video's poster.
create or replace function public.owner_item_get(item_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(i) - 'page_id' - 'created_by' - 'updated_by' || jsonb_build_object('media', coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'position', m.position, 'width', m.width,
        'height', m.height, 'duration_ms', m.duration_ms, 'alt', m.alt, 'alt_alt', m.alt_alt,
        'preview', (select jsonb_build_object('bucket', v.bucket, 'path', v.path) from public.media_variants v
          where v.media_id = m.id and v.variant = case m.kind when 'photo' then 'thumb' else 'poster' end::public.media_variant))
      order by m.position, m.id)
    from public.media m
    where m.item_id = i.id and m.page_id = i.page_id and m.state = 'ready'), '[]'::jsonb))
  from public.items i
  where i.id = owner_item_get.item_id and i.page_id = public.owner_page_id()
$$;

-- owner_item_save gains alts: [{id, alt, alt_alt}] for this item's media, or null to leave alt text alone. An entry
-- for media of another item or page is ignored (E56); an empty string stores no alt text. Without a second language
-- no media of the item keeps second-language alt text (owner UI O5, removeSecondHint).
drop function public.owner_item_save(uuid, int, public.item_kind, public.lang, text, text, public.lang, text, text, date,
  public.date_precision, boolean, boolean);
create function public.owner_item_save(
  item_id uuid, expected_version int, kind public.item_kind, lang public.lang, title text, body text,
  lang_alt public.lang, title_alt text, body_alt text, event_date date, date_precision public.date_precision,
  recurs_yearly boolean, remind_owner boolean, alts jsonb default null)
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
  if owner_item_save.alts is not null and jsonb_typeof(owner_item_save.alts) <> 'array' then
    raise exception 'owner_item_save needs alts as a list' using errcode = '22023';
  end if;

  -- A create names no version and carries an id the screen chose, so a retry after a lost answer finds the item it
  -- made instead of making a second one (Codex review of T2.2). A new item has no media, so alts are not read.
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
  if owner_item_save.alts is not null then
    update public.media m set alt = nullif(a.alt, ''), alt_alt = nullif(a.alt_alt, '')
      from jsonb_to_recordset(owner_item_save.alts) as a(id uuid, alt text, alt_alt text)
      where m.id = a.id and m.item_id = owner_item_save.item_id and m.page_id = page;
  end if;
  if owner_item_save.lang_alt is null then
    update public.media m set alt_alt = null
      where m.item_id = owner_item_save.item_id and m.page_id = page and m.alt_alt is not null;
  end if;
  return jsonb_build_object('id', owner_item_save.item_id, 'version', saved);
end
$$;

-- The storage read policy: the owner sees the files of their own page's media, and nothing else in a media bucket.
create function public.owner_media_readable(bucket text, path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.media_variants v
    join public.memberships m on m.page_id = v.page_id and m.user_id = auth.uid() and m.role = 'owner'
    where v.bucket = owner_media_readable.bucket and v.path = owner_media_readable.path)
$$;
create policy media_owner_read on storage.objects for select to authenticated
  using (bucket_id like 'media-%' and public.owner_media_readable(bucket_id, name));

revoke all on function
  public.owner_item_save(uuid, int, public.item_kind, public.lang, text, text, public.lang, text, text, date, public.date_precision, boolean, boolean, jsonb),
  public.owner_media_readable(text, text)
from public;
grant execute on function
  public.owner_item_save(uuid, int, public.item_kind, public.lang, text, text, public.lang, text, text, date, public.date_precision, boolean, boolean, jsonb),
  public.owner_media_readable(text, text)
to authenticated;
