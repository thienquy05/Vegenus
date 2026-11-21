-- T2.4: the Home item for O17 and the O2 Home card (owner UI "O17 Home editor"; PRD Q144; design 3 §3.3; E14, E15,
-- E53, E56). Home has no title (the couple title is the partner names) and a note of at most 600 characters per
-- language. Its photos are picks of ready photos from the page's memories, nothing stored twice; up to seven, in
-- order; the first guest-visible pick is the cover (`cover_media_id` of design 3 is not built). Each pick keeps its
-- draft position and the position guests see, so Publish and Unpublish move only positions, and a deleted photo
-- drops out of both through its foreign key. A pick whose memory is unpublished stays (hidden; guests skip it).

alter table public.items alter column title drop not null;
alter table public.items add constraint items_title_kind check (
  case when kind = 'home' then title is null and title_alt is null else title is not null end);
alter table public.items add constraint items_home_note check (
  kind <> 'home' or (char_length(body) <= 600 and char_length(body_alt) <= 600));

create table public.home_picks (
  item_id uuid not null,
  page_id uuid not null,
  media_id uuid not null,
  position smallint check (position between 0 and 6),
  published_position smallint check (published_position between 0 and 6),
  primary key (item_id, media_id),
  foreign key (item_id, page_id) references public.items (id, page_id) on delete cascade,
  foreign key (media_id, page_id) references public.media (id, page_id) on delete cascade,
  -- A row is in the draft, in what guests see, or both.
  check (position is not null or published_position is not null),
  -- Deferred: Publish copies every position in one statement.
  unique (item_id, position) deferrable initially deferred,
  unique (item_id, published_position) deferrable initially deferred
);
create index home_picks_media on public.home_picks (media_id, page_id);
alter table public.home_picks enable row level security;

-- Create or edit Home. A create names no version and carries the id the screen chose: a retry of the same create
-- answers its Home, and anything else (another id while a Home exists, other content) answers null, as a stale
-- edit does, so the screen re-reads (Q144 defaults 10 and 18). picks: media ids in order; an id that is not a ready
-- photo of this page's memories is left out (a photo deleted since the picker opened, or another page's).
create function public.owner_home_save(
  item_id uuid, expected_version int, lang public.lang, body text, lang_alt public.lang, body_alt text,
  start_date date, picks uuid[])
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  page uuid := public.owner_page_id();
  kept uuid[];
  saved int;
begin
  if page is null then
    raise exception 'not allowed to edit items' using errcode = '42501';
  end if;
  if owner_home_save.item_id is null or owner_home_save.lang is null or owner_home_save.picks is null
    or cardinality(owner_home_save.picks) > 7 or array_position(owner_home_save.picks, null) is not null
    or (select count(distinct p) from unnest(owner_home_save.picks) p) <> cardinality(owner_home_save.picks) then
    raise exception 'owner_home_save needs an id, a language and up to seven different picks' using errcode = '22023';
  end if;
  -- Lock order of a memory delete (memory row, then its media and picks): the picked photos' memories first, in id
  -- order, so a memory delete queues before it holds anything this save needs (no deadlock; reviewer, T2.4a).
  perform 1 from public.items mi
    where mi.page_id = page and mi.kind = 'memory'
      and mi.id in (select m.item_id from public.media m where m.id = any (owner_home_save.picks))
    order by mi.id for key share;
  -- The kept photos are locked against deletion until commit: a delete already under way finishes first and its
  -- photo drops out here, instead of failing the picks' foreign key later.
  select coalesce(array_agg(s.id order by s.ord), '{}') into kept from (
    select p.id, p.ord from unnest(owner_home_save.picks) with ordinality p(id, ord)
    join public.media m on m.id = p.id and m.page_id = page and m.kind = 'photo' and m.state = 'ready'
    join public.items mi on mi.id = m.item_id and mi.page_id = page and mi.kind = 'memory'
    for key share of m) s;

  if owner_home_save.expected_version is null then
    -- No conflict target: the id and the one-Home index both answer here, never as an error.
    insert into public.items (id, page_id, kind, lang, body, lang_alt, body_alt, start_date, created_by, updated_by)
      values (owner_home_save.item_id, page, 'home', owner_home_save.lang, owner_home_save.body, owner_home_save.lang_alt,
        owner_home_save.body_alt, owner_home_save.start_date, auth.uid(), auth.uid())
      on conflict do nothing
      returning version into saved;
    if found then
      insert into public.home_picks (item_id, page_id, media_id, position)
        select owner_home_save.item_id, page, k.id, k.ord - 1 from unnest(kept) with ordinality k(id, ord);
      return jsonb_build_object('id', owner_home_save.item_id, 'version', saved);
    end if;
    perform 1 from public.items i
      where i.id = owner_home_save.item_id and i.page_id = page and i.kind = 'home' and i.version = 1
        and (i.lang, i.body, i.lang_alt, i.body_alt, i.start_date) is not distinct from
          (owner_home_save.lang, owner_home_save.body, owner_home_save.lang_alt, owner_home_save.body_alt, owner_home_save.start_date)
        and array(select hp.media_id from public.home_picks hp
          where hp.item_id = i.id and hp.position is not null order by hp.position) = kept;
    return case when found then jsonb_build_object('id', owner_home_save.item_id, 'version', 1) end;
  end if;

  update public.items i set lang = owner_home_save.lang, body = owner_home_save.body, lang_alt = owner_home_save.lang_alt,
      body_alt = owner_home_save.body_alt, start_date = owner_home_save.start_date, updated_by = auth.uid()
    where i.id = owner_home_save.item_id and i.page_id = page and i.kind = 'home'
      and i.version = owner_home_save.expected_version
    returning i.version into saved;
  if not found then
    return null; -- changed elsewhere, not Home, or not this page's (E15, E56)
  end if;
  -- A dropped pick leaves the draft; it stays only while guests still see it.
  delete from public.home_picks hp
    where hp.item_id = owner_home_save.item_id and hp.published_position is null and hp.media_id <> all (kept);
  update public.home_picks hp set position = null
    where hp.item_id = owner_home_save.item_id and hp.media_id <> all (kept);
  insert into public.home_picks (item_id, page_id, media_id, position)
    select owner_home_save.item_id, page, k.id, k.ord - 1 from unnest(kept) with ordinality k(id, ord)
    on conflict on constraint home_picks_pkey do update set position = excluded.position;
  return jsonb_build_object('id', owner_home_save.item_id, 'version', saved);
end
$$;

-- Publish and unpublish as before; for Home they also show guests the draft's picks, or none.
create or replace function public.owner_item_set_status(item_id uuid, expected_version int, status public.pub_status)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  page uuid := public.owner_page_id();
  saved int;
  found_kind public.item_kind;
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
    returning i.version, i.kind into saved, found_kind;
  if found_kind = 'home' then
    -- Picks no longer in the draft were kept only for guests: either way guests stop seeing them.
    delete from public.home_picks hp where hp.item_id = owner_item_set_status.item_id and hp.position is null;
    update public.home_picks hp
      set published_position = case when owner_item_set_status.status = 'published' then hp.position end
      where hp.item_id = owner_item_set_status.item_id;
  end if;
  return saved; -- null: changed elsewhere, gone, or not this page's
end
$$;

-- Home has no Delete (Q144 default 7): a Home id answers like a stale or foreign one.
create or replace function public.owner_item_delete(item_id uuid, expected_version int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  page uuid := public.owner_page_id();
begin
  if page is null then
    raise exception 'not allowed to edit items' using errcode = '42501';
  end if;
  delete from public.items i
    where i.id = owner_item_delete.item_id and i.page_id = page and i.version = owner_item_delete.expected_version
      and i.kind <> 'home';
  if not found then
    return false;
  end if;
  insert into public.item_tombstones (id, page_id) values (owner_item_delete.item_id, page);
  return true;
end
$$;

-- Home takes no uploads (Q144: its photos are picks of memories' photos): Begin answers a Home id as a missing item.
-- Unchanged from 20261111120000_media.sql but for the kind check.
create or replace function public.owner_upload_begin(item_id uuid, kind public.media_kind, variants public.media_variant[])
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  page uuid := public.upload_page();
  new_media uuid := gen_random_uuid();
  -- Hosted signed upload URLs last 2 hours (Q135); the route mints them right after Begin, so with 5 minutes of margin
  -- they expire before write_until, as design 3 §3.4 requires.
  window_end timestamptz := now() + interval '2 hours 5 minutes';
  admitted jsonb;
  charge bigint;
begin
  if page is null then
    raise exception 'not allowed to upload' using errcode = '42501';
  end if;
  -- A photo has a thumbnail and a display file (and may have a full one); a video a poster and the clip (and may have
  -- a thumbnail); a voice note one audio file. Each variant once.
  if owner_upload_begin.kind is null or coalesce(cardinality(owner_upload_begin.variants), 0) = 0
    or cardinality(owner_upload_begin.variants) <> (select count(distinct v) from unnest(owner_upload_begin.variants) v)
    -- (each CASE in parentheses: an IF condition otherwise ends at the first THEN)
    or not owner_upload_begin.variants <@ (case owner_upload_begin.kind when 'photo' then '{thumb,display,full}'
      when 'video' then '{thumb,poster,video}' else '{audio}' end)::public.media_variant[]
    or not owner_upload_begin.variants @> (case owner_upload_begin.kind when 'photo' then '{thumb,display}'
      when 'video' then '{poster,video}' else '{audio}' end)::public.media_variant[] then
    raise exception 'these files do not make a % upload', owner_upload_begin.kind using errcode = '22023';
  end if;

  -- Lock order: page, then the item, then media rows (expiry). An item delete locks the item, then its media, so Begin
  -- never holds a media row of that item while waiting for the item (Codex T2.3a round 3).
  perform 1 from public.pages p where p.id = page for update;
  perform 1 from public.items i where i.id = owner_upload_begin.item_id and i.page_id = page and i.kind <> 'home' for share;
  if not found then
    return null;
  end if;
  perform public.expire_uploads(page);

  select jsonb_agg(jsonb_build_object('variant', v, 'bucket', b.id,
      'path', 'pages/' || page || '/media/' || new_media || '/' || v, 'max_bytes', b.file_size_limit) order by v),
    sum(b.file_size_limit)
    into admitted, charge
  from unnest(owner_upload_begin.variants) v join storage.buckets b on b.id = public.media_bucket(v);
  if public.storage_used(page) + charge > (select p.storage_budget_bytes from public.pages p where p.id = page) then
    raise exception 'storage full' using errcode = '53400';
  end if;

  insert into public.media (id, page_id, item_id, kind, position, created_by)
    values (new_media, page, owner_upload_begin.item_id, owner_upload_begin.kind,
      coalesce((select max(m.position) from public.media m where m.item_id = owner_upload_begin.item_id), 0) + 1, auth.uid());
  insert into public.upload_reservations (media_id, page_id, files, charged_bytes, write_until)
    values (new_media, page, admitted, charge, window_end);
  return jsonb_build_object('media_id', new_media, 'files', admitted, 'write_until', window_end);
end
$$;

-- O17 and the O2 card: the page's Home with its draft picks in order, or null. hidden: the pick's memory is
-- unpublished, so guests skip it. unpublished_changes: the published Home differs from the draft, picks included.
create function public.owner_home_get() returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(i) - 'page_id' - 'created_by' - 'updated_by' || jsonb_build_object(
    'timezone', p.timezone,
    'unpublished_changes', i.published is not null and (i.published is distinct from public.item_snapshot(i)
      or exists (select 1 from public.home_picks hp where hp.item_id = i.id and hp.position is distinct from hp.published_position)),
    'picks', coalesce((
      select jsonb_agg(jsonb_build_object('media_id', m.id, 'item_id', m.item_id, 'hidden', mi.status <> 'published',
          'alt', m.alt, 'alt_alt', m.alt_alt, 'width', m.width, 'height', m.height,
          'preview', (select jsonb_build_object('bucket', v.bucket, 'path', v.path) from public.media_variants v
            where v.media_id = m.id and v.variant = 'thumb'))
        order by hp.position)
      from public.home_picks hp
      join public.media m on m.id = hp.media_id
      join public.items mi on mi.id = m.item_id
      where hp.item_id = i.id and hp.position is not null), '[]'::jsonb))
  from public.items i
  join public.pages p on p.id = i.page_id
  where i.page_id = public.owner_page_id() and i.kind = 'home'
$$;

-- The O17 picker: ready photos of published memories, grouped by memory, newest memory first (as O4 lists them).
-- shortcut: one unpaged list; page it if a couple's photo count makes the picker slow.
create function public.owner_home_photos() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('item_id', i.id, 'lang', i.lang, 'title', i.title, 'title_alt', i.title_alt,
      'event_date', i.event_date, 'date_precision', i.date_precision, 'photos', ph.photos)
    order by i.event_date desc nulls last, i.sort_order desc, i.id), '[]'::jsonb)
  from public.items i
  cross join lateral (
    select jsonb_agg(jsonb_build_object('media_id', m.id, 'alt', m.alt, 'alt_alt', m.alt_alt, 'width', m.width,
        'height', m.height,
        'preview', (select jsonb_build_object('bucket', v.bucket, 'path', v.path) from public.media_variants v
          where v.media_id = m.id and v.variant = 'thumb'))
      order by m.position, m.id) photos
    from public.media m
    where m.item_id = i.id and m.page_id = i.page_id and m.kind = 'photo' and m.state = 'ready') ph
  where i.page_id = public.owner_page_id() and i.kind = 'memory' and i.status = 'published' and ph.photos is not null
$$;

revoke all on function
  public.owner_home_save(uuid, int, public.lang, text, public.lang, text, date, uuid[]),
  public.owner_home_get(),
  public.owner_home_photos()
from public;
grant execute on function
  public.owner_home_save(uuid, int, public.lang, text, public.lang, text, date, uuid[]),
  public.owner_home_get(),
  public.owner_home_photos()
to authenticated;
