-- Security gate, Phase 2 (Codex re-review; Q141 point 3): Complete also checks the type storage recorded for each
-- file against its bucket's list of allowed types, so a file of another type never reaches ready. A mismatch fails the
-- media and queues its files for deletion, as a file over its size does. Otherwise unchanged from the media migration.

create or replace function public.owner_upload_complete(media_id uuid, width int, height int, duration_ms int)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  page uuid := public.upload_page();
  r public.upload_reservations;
  missing boolean;
  over boolean;
  wrong_type boolean;
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
      bool_or((o.metadata ->> 'size')::bigint > (f ->> 'max_bytes')::bigint),
      bool_or(o.id is not null and o.metadata ->> 'mimetype' <> all (coalesce(b.allowed_mime_types, '{}'))) -- written files only
    into missing, over, wrong_type
  from jsonb_array_elements(r.files) f
  left join storage.objects o on o.bucket_id = f ->> 'bucket' and o.name = f ->> 'path'
  left join storage.buckets b on b.id = o.bucket_id;
  if wrong_type then -- a type its bucket does not allow (Q141): fail and queue the files, as for a file too large
    update public.media m set state = 'failed' where m.id = r.media_id;
    delete from public.upload_reservations u where u.media_id = r.media_id;
    return 'invalid_file';
  end if;
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
