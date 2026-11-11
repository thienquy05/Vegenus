-- T2.3c: daily reconcile of the media buckets (design 3 §3.4 "Reconcile"; Q134). Run by the daily cron route as
-- vegenus_server, before the deletion worker. Two corrections, both toward charging what is really stored:
--  - an object in a media bucket that no variant, live reservation or pending deletion accounts for is queued for
--    deletion at its real size (due at once: no live upload URL can write a path that no reservation holds);
--  - a finished file whose real size differs from the recorded one is charged at its real size (security review of
--    T2.3a: a larger overwrite through a still-valid upload URL must not stay uncharged; T2.3b mints URLs with
--    upsert false, so this is the safety net).
-- Returns {orphans, resized}; the cron route reports non-zero counts as an alert.

create function public.worker_reconcile() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  orphans int;
  resized int;
begin
  -- Charges only go up here, so take the page locks first, in id order, as Begin does: a Begin checking the budget
  -- then sees the new charges instead of admitting against the old total (Codex T2.3c).
  -- ponytail: locks every page; one page exists (Q84). Lock only the affected pages when there are many.
  perform 1 from public.pages p order by p.id for update;

  with fixed as (
    update public.media_variants v set bytes = (o.metadata ->> 'size')::bigint
    from storage.objects o
    where o.bucket_id = v.bucket and o.name = v.path and o.metadata ->> 'size' is not null
      and (o.metadata ->> 'size')::bigint <> v.bytes
    returning 1)
  select count(*) into resized from fixed;

  -- One statement, one snapshot: an upload completing meanwhile is seen either as its reservation or as its variants.
  insert into public.storage_deletions (page_id, bucket, path, bytes)
    select coalesce(substring(o.name from '^pages/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/')::uuid,
        '00000000-0000-0000-0000-000000000000'),
      o.bucket_id, o.name, coalesce((o.metadata ->> 'size')::bigint, 0)
    from storage.objects o
    where o.bucket_id like 'media-%'
      and not exists (select 1 from public.media_variants v where v.bucket = o.bucket_id and v.path = o.name)
      and not exists (select 1 from public.upload_reservations r cross join jsonb_array_elements(r.files) f
        where f ->> 'bucket' = o.bucket_id and f ->> 'path' = o.name)
      and not exists (select 1 from public.storage_deletions d
        where d.bucket = o.bucket_id and d.path = o.name and d.done_at is null);
  get diagnostics orphans = row_count;
  return jsonb_build_object('orphans', orphans, 'resized', resized);
end
$$;

-- Retries without starvation (Codex T2.3c): a deletion whose file is still there counts an attempt, and the worker is
-- handed the least-tried rows first, so files that keep failing cannot hold back newer ones.
alter table public.storage_deletions add column attempts int not null default 0;

create or replace function public.worker_due_deletions(max_rows int)
returns table (id bigint, bucket text, path text, not_before timestamptz)
language sql stable security definer set search_path = '' as $$
  select d.id, d.bucket, d.path, d.not_before from public.storage_deletions d
  where d.done_at is null and d.not_before <= now()
  order by d.attempts, d.id
  limit worker_due_deletions.max_rows
$$;

create or replace function public.worker_deletion_done(deletion_id bigint) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  gone_media uuid;
begin
  if exists (select 1 from public.storage_deletions d join storage.objects o on o.bucket_id = d.bucket and o.name = d.path
      where d.id = worker_deletion_done.deletion_id) then
    update public.storage_deletions d set attempts = d.attempts + 1
      where d.id = worker_deletion_done.deletion_id and d.done_at is null;
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

revoke all on function public.worker_reconcile() from public;
grant execute on function public.worker_reconcile() to vegenus_server;
