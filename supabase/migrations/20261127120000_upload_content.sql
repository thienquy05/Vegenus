-- Security gate, Phase 2 (Codex review): the upload Complete route checks every stored file by its bytes before the
-- database marks the media ready (design 7 §3 "type validation by content"). owner_upload_files lists the files of the
-- caller's live reservation with the type storage recorded and whether each is written yet (the same test Complete
-- uses), and the storage read policy now also lets the owner read the files of their own live pending upload.

create function public.owner_upload_files(media_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_agg(jsonb_build_object('bucket', f ->> 'bucket', 'path', f ->> 'path', 'mime', o.metadata ->> 'mimetype',
      'present', o.id is not null and o.metadata ->> 'size' is not null and o.metadata ->> 'mimetype' is not null)
    order by f ->> 'path')
  from public.upload_reservations u
  cross join jsonb_array_elements(u.files) f
  left join storage.objects o on o.bucket_id = f ->> 'bucket' and o.name = f ->> 'path'
  where u.media_id = owner_upload_files.media_id and u.page_id = public.upload_page() and u.write_until >= now()
$$;

create or replace function public.owner_media_readable(bucket text, path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.media_variants v
    join public.memberships m on m.page_id = v.page_id and m.user_id = auth.uid() and m.role = 'owner'
    where v.bucket = owner_media_readable.bucket and v.path = owner_media_readable.path)
  or exists (
    select 1 from public.upload_reservations u
    join public.memberships m on m.page_id = u.page_id and m.user_id = auth.uid() and m.role = 'owner'
    where u.write_until >= now() and u.files @> jsonb_build_array(jsonb_build_object('bucket', owner_media_readable.bucket, 'path', owner_media_readable.path)))
$$;

revoke all on function public.owner_upload_files(uuid) from public;
grant execute on function public.owner_upload_files(uuid) to authenticated;
