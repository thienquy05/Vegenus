-- T2.3a: media upload admission, charging and deletion (design 3 §3.4; PRD FR7, E9, E10, E16, E56; Q132-Q135).
-- Every byte that may still be in a bucket is charged in exactly one place:
--   used(page) = media_variants.bytes + upload_reservations.charged_bytes + pending storage_deletions.bytes
-- and moves between them inside one transaction. Begin reserves the class limit of every admitted file (a storage
-- policy cannot see the size, so the class limit is the most a client can write); Complete reads the real sizes from
-- storage.objects; Cancel, expiry and a refused Complete queue the admitted paths for deletion, fenced until
-- write_until + 15 minutes (Q135); deleting finished media queues its real sizes. The worker frees a charge only once
-- the object is gone. Signed upload URLs are minted by the upload route (T2.3b); the cron worker is T2.3c (Q134).
-- media.item_id is not null (design 3 allowed null while uploading): items now exist before their media (T2.2 ids).

create type public.media_kind as enum ('photo', 'video', 'audio');
create type public.media_state as enum ('uploading', 'ready', 'failed');
create type public.media_variant as enum ('thumb', 'display', 'poster', 'full', 'video', 'audio');

-- 900 MiB of the 1 GB free plan (design 3 §3.4).
alter table public.pages add column storage_budget_bytes bigint not null default 943718400 check (storage_budget_bytes >= 0);

-- One private bucket per size class; the limits of the bucket itself reject a larger file or another type (verified,
-- Supabase docs). These rows are the single source of the class limits.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('media-thumb', 'media-thumb', false, 307200, '{image/webp,image/jpeg}'),
  ('media-display', 'media-display', false, 2097152, '{image/webp,image/jpeg}'),
  ('media-full', 'media-full', false, 8388608, '{image/webp,image/jpeg}'),
  ('media-audio', 'media-audio', false, 10485760, '{audio/mp4,audio/webm}'),
  ('media-video', 'media-video', false, 52428800, '{video/mp4,video/webm}');

create function public.media_bucket(variant public.media_variant) returns text
language sql immutable set search_path = '' as $$
  select case media_bucket.variant when 'thumb' then 'media-thumb' when 'display' then 'media-display'
    when 'poster' then 'media-display' when 'full' then 'media-full' when 'video' then 'media-video' else 'media-audio' end
$$;

create table public.media (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages on delete cascade,
  item_id uuid not null,
  kind public.media_kind not null,
  state public.media_state not null default 'uploading',
  position smallint not null default 0,
  width int check (width > 0),
  height int check (height > 0),
  duration_ms int check (duration_ms >= 0),
  alt text check (alt is nfc normalized and char_length(alt) <= 300),
  alt_alt text check (alt_alt is nfc normalized and char_length(alt_alt) <= 300),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (id, page_id),
  foreign key (item_id, page_id) references public.items (id, page_id) on delete cascade
);
create index media_item on public.media (item_id, position);

create table public.media_variants (
  media_id uuid not null,
  page_id uuid not null,
  variant public.media_variant not null,
  bucket text not null,
  path text not null,
  mime text not null,
  bytes bigint not null check (bytes >= 0),
  -- The upload window of this file: its signed upload URL can write the path again until then (Codex T2.3a).
  write_until timestamptz not null,
  primary key (media_id, variant),
  unique (bucket, path),
  foreign key (media_id, page_id) references public.media (id, page_id) on delete cascade
);
create index media_variants_page on public.media_variants (page_id);

-- files: the only paths this upload may write, [{variant, bucket, path, max_bytes}].
create table public.upload_reservations (
  media_id uuid primary key,
  page_id uuid not null,
  files jsonb not null,
  charged_bytes bigint not null check (charged_bytes >= 0),
  write_until timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (media_id, page_id) references public.media (id, page_id) on delete cascade
);
create index upload_reservations_page on public.upload_reservations (page_id, write_until);

-- No foreign keys: a pending deletion outlives its media and its page, so the files are still removed.
create table public.storage_deletions (
  id bigint generated always as identity primary key,
  page_id uuid not null,
  media_id uuid,
  bucket text not null,
  path text not null,
  bytes bigint not null check (bytes >= 0),
  not_before timestamptz not null default now(),
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index storage_deletions_due on public.storage_deletions (not_before) where done_at is null;
create index storage_deletions_page on public.storage_deletions (page_id) where done_at is null;

-- Writes go through the functions below only (design 3 §3.4): RLS on, no policies.
alter table public.media enable row level security;
alter table public.media_variants enable row level security;
alter table public.upload_reservations enable row level security;
alter table public.storage_deletions enable row level security;

create function public.storage_used(page_id uuid) returns bigint
language sql stable set search_path = '' as $$
  select coalesce((select sum(v.bytes) from public.media_variants v where v.page_id = storage_used.page_id), 0)
    + coalesce((select sum(r.charged_bytes) from public.upload_reservations r where r.page_id = storage_used.page_id), 0)
    + coalesce((select sum(d.bytes) from public.storage_deletions d where d.page_id = storage_used.page_id and d.done_at is null), 0)
$$;

-- Deleting finished media, directly or through an item or page cascade, moves its real bytes to the queue. Fenced
-- like an abandoned upload: until its upload URL is dead and the drain is over, a write could land on the path again.
create function public.media_variants_charge() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into public.storage_deletions (page_id, media_id, bucket, path, bytes, not_before)
    values (old.page_id, old.media_id, old.bucket, old.path, old.bytes, greatest(now(), old.write_until + interval '15 minutes'));
  return old;
end
$$;
create trigger media_variants_charge before delete on public.media_variants
  for each row execute function public.media_variants_charge();

-- A reservation that ends without becoming variants (cancel, expiry, refused Complete, cascade) moves its charge to
-- the queue, fenced: a write the storage service accepted may still land until write_until + drain (Q135: 15 min).
create function public.upload_reservations_charge() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into public.storage_deletions (page_id, media_id, bucket, path, bytes, not_before)
    select old.page_id, old.media_id, f ->> 'bucket', f ->> 'path', (f ->> 'max_bytes')::bigint,
      old.write_until + interval '15 minutes'
    from jsonb_array_elements(old.files) f
    where not exists (select 1 from public.media_variants v where v.bucket = f ->> 'bucket' and v.path = f ->> 'path');
  return old;
end
$$;
create trigger upload_reservations_charge before delete on public.upload_reservations
  for each row execute function public.upload_reservations_charge();

-- Lock order, in every function and cascade: media row, then its reservation, so concurrent deletes, cancels,
-- completions and expiry queue instead of deadlocking (Codex T2.3a round 2).

-- Expire overdue reservations of one page, or of every page (null). Returns how many.
create function public.expire_uploads(page_id uuid) returns int
language plpgsql set search_path = '' as $$
declare
  n int;
begin
  perform 1 from public.media m join public.upload_reservations r on r.media_id = m.id
    where (expire_uploads.page_id is null or r.page_id = expire_uploads.page_id) and r.write_until < now()
    order by m.id for update of m;
  with gone as (
    delete from public.upload_reservations r
    where (expire_uploads.page_id is null or r.page_id = expire_uploads.page_id) and r.write_until < now()
    returning r.media_id)
  update public.media m set state = 'failed' from gone where m.id = gone.media_id;
  get diagnostics n = row_count;
  return n;
end
$$;

-- The page of the caller; only an owner has one (a co-editor is reserved, Q35).
create function public.upload_page() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.page_id from public.memberships m where m.user_id = auth.uid() and m.role = 'owner'
$$;

-- Begin (design 3 §3.4): under the page row lock, expire overdue reservations, then admit the files if the budget
-- holds. Returns {media_id, files, write_until}, or null for an item that is not of the caller (E56).
create function public.owner_upload_begin(item_id uuid, kind public.media_kind, variants public.media_variant[])
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
  perform 1 from public.items i where i.id = owner_upload_begin.item_id and i.page_id = page for share;
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

-- Complete: read the real sizes from storage, never from the browser: ready, too_large (refused: failed, files
-- queued), incomplete (a file not written yet; nothing changes), or null (no reservation, late, not of the caller).
create function public.owner_upload_complete(media_id uuid, width int, height int, duration_ms int)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  page uuid := public.upload_page();
  r public.upload_reservations;
  missing boolean;
  over boolean;
begin
  if page is null then
    raise exception 'not allowed to upload' using errcode = '42501';
  end if;
  -- The row locks order Complete against Cancel, expiry and delete: whichever comes second finds the reservation gone.
  perform 1 from public.media m where m.id = owner_upload_complete.media_id and m.page_id = page for update;
  select * into r from public.upload_reservations u
    where u.media_id = owner_upload_complete.media_id and u.page_id = page for update;
  if not found or r.write_until < now() then
    return null;
  end if;

  select bool_or(o.id is null or o.metadata ->> 'size' is null or o.metadata ->> 'mimetype' is null),
      bool_or((o.metadata ->> 'size')::bigint > (f ->> 'max_bytes')::bigint)
    into missing, over
  from jsonb_array_elements(r.files) f
  left join storage.objects o on o.bucket_id = f ->> 'bucket' and o.name = f ->> 'path';
  if over then
    update public.media m set state = 'failed' where m.id = r.media_id;
    delete from public.upload_reservations u where u.media_id = r.media_id;
    return 'too_large';
  end if;
  if missing then
    return 'incomplete';
  end if;

  insert into public.media_variants (media_id, page_id, variant, bucket, path, mime, bytes, write_until)
    select r.media_id, page, (f ->> 'variant')::public.media_variant, o.bucket_id, o.name, o.metadata ->> 'mimetype',
      (o.metadata ->> 'size')::bigint, r.write_until
    from jsonb_array_elements(r.files) f
    join storage.objects o on o.bucket_id = f ->> 'bucket' and o.name = f ->> 'path';
  delete from public.upload_reservations u where u.media_id = r.media_id; -- its paths are variants now: nothing queued
  update public.media m set state = 'ready', width = owner_upload_complete.width, height = owner_upload_complete.height,
      duration_ms = owner_upload_complete.duration_ms
    where m.id = r.media_id;
  return 'ready';
end
$$;

create function public.owner_upload_cancel(media_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  page uuid := public.upload_page();
begin
  if page is null then
    raise exception 'not allowed to upload' using errcode = '42501';
  end if;
  perform 1 from public.media m where m.id = owner_upload_cancel.media_id and m.page_id = page for update;
  delete from public.upload_reservations u where u.media_id = owner_upload_cancel.media_id and u.page_id = page;
  if not found then
    return false;
  end if;
  update public.media m set state = 'failed' where m.id = owner_upload_cancel.media_id;
  return true;
end
$$;

-- Delete one media, finished or not; the triggers queue its files.
create function public.owner_media_delete(media_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  page uuid := public.upload_page();
begin
  if page is null then
    raise exception 'not allowed to upload' using errcode = '42501';
  end if;
  delete from public.media m where m.id = owner_media_delete.media_id and m.page_id = page;
  return found;
end
$$;

-- The storage insert policy (design 3 §3.4): only a path admitted by a live reservation of the page of the caller. No
-- update or upsert policy, so an admitted object is written once.
create function public.owner_upload_admitted(bucket text, path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.upload_reservations r
    join public.memberships m on m.page_id = r.page_id and m.user_id = auth.uid() and m.role = 'owner'
    cross join jsonb_array_elements(r.files) f
    where f ->> 'bucket' = owner_upload_admitted.bucket and f ->> 'path' = owner_upload_admitted.path
      and r.write_until > now())
$$;
create policy media_upload_admitted on storage.objects for insert to authenticated
  with check (bucket_id like 'media-%' and public.owner_upload_admitted(bucket_id, name));

-- Worker functions (the T2.3c daily cron route calls them as vegenus_server, Q134).
create function public.worker_expire_uploads() returns int
language sql security definer set search_path = '' as $$
  select public.expire_uploads(null)
$$;

create function public.worker_due_deletions(max_rows int)
returns table (id bigint, bucket text, path text, not_before timestamptz)
language sql stable security definer set search_path = '' as $$
  select d.id, d.bucket, d.path, d.not_before from public.storage_deletions d
  where d.done_at is null and d.not_before <= now()
  order by d.id
  limit worker_due_deletions.max_rows
$$;

-- Mark a deletion done once its object is gone: only then is the space free. A failed media row leaves with its last
-- pending file (E9).
create function public.worker_deletion_done(deletion_id bigint) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  gone_media uuid;
begin
  if exists (select 1 from public.storage_deletions d join storage.objects o on o.bucket_id = d.bucket and o.name = d.path
      where d.id = worker_deletion_done.deletion_id) then
    return false;
  end if;
  update public.storage_deletions d set done_at = now()
    where d.id = worker_deletion_done.deletion_id and d.done_at is null and d.not_before <= now()
    returning d.media_id into gone_media;
  if not found then
    return false;
  end if;
  -- Lock the media row before counting: a confirmation of its other file waits here and then sees this one, so the
  -- last of two concurrent confirmations always removes the row (Codex T2.3a).
  perform 1 from public.media m where m.id = gone_media for update;
  delete from public.media m where m.id = gone_media and m.state = 'failed'
    and not exists (select 1 from public.storage_deletions d where d.media_id = gone_media and d.done_at is null);
  return true;
end
$$;

revoke all on function
  public.media_bucket(public.media_variant), public.storage_used(uuid), public.media_variants_charge(),
  public.upload_reservations_charge(), public.expire_uploads(uuid), public.upload_page(),
  public.owner_upload_begin(uuid, public.media_kind, public.media_variant[]),
  public.owner_upload_complete(uuid, int, int, int), public.owner_upload_cancel(uuid), public.owner_media_delete(uuid),
  public.owner_upload_admitted(text, text), public.worker_expire_uploads(), public.worker_due_deletions(int),
  public.worker_deletion_done(bigint)
from public;
grant execute on function
  public.owner_upload_begin(uuid, public.media_kind, public.media_variant[]),
  public.owner_upload_complete(uuid, int, int, int), public.owner_upload_cancel(uuid), public.owner_media_delete(uuid),
  public.owner_upload_admitted(text, text)
to authenticated;
grant execute on function
  public.worker_expire_uploads(), public.worker_due_deletions(int), public.worker_deletion_done(bigint)
to vegenus_server;
