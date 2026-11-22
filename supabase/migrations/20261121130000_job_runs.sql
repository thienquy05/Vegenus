-- T2.5a: the daily job record, health and the owner usage read (PRD Q145; design 3 §3.9 `job_runs`; owner UI "O10
-- Usage"; E23). The daily cron (/api/cron/storage, which is also the keep-alive) records one row per run as
-- vegenus_server: times, the result and counts, no personal data (Q145 3). A run is a success only when it answered 200
-- with no failed deletion (Q145 4, 12). Rows are kept 30 days (Q45): each record deletes older ones. The start comes
-- from the app's clock and is clamped to the database's, so a clock ahead of it never loses a run.

create table public.job_runs (
  id bigint generated always as identity primary key,
  job text not null default 'storage' check (job = 'storage'),
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  result text not null check (result in ('200', '200-deletion-failed', '503')),
  expired int check (expired >= 0),
  orphans int check (orphans >= 0),
  resized int check (resized >= 0),
  deleted int check (deleted >= 0),
  failed int check (failed >= 0),
  check (started_at <= finished_at)
);
create index job_runs_finished on public.job_runs (finished_at desc);
alter table public.job_runs enable row level security;

create function public.worker_job_record(started timestamptz, run_result text, expired int, orphans int, resized int,
  deleted int, failed int) returns void
language sql security definer set search_path = '' as $$
  delete from public.job_runs r where r.finished_at < now() - interval '30 days';
  insert into public.job_runs (started_at, result, expired, orphans, resized, deleted, failed)
    values (least(worker_job_record.started, now()), worker_job_record.run_result, worker_job_record.expired, worker_job_record.orphans,
      worker_job_record.resized, worker_job_record.deleted, worker_job_record.failed);
$$;

-- Q145 5, 6: healthy while a success finished in the last 26 hours (the daily cron's ±59 min plus slack). The public
-- health route reads only this boolean, through the server connection.
create function public.health_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.job_runs r where r.result = '200' and r.finished_at > now() - interval '26 hours')
$$;

-- Q145 13: the one snapshot O2 and O10 read. Storage parts as storage_used counts them; the job fields are the same for
-- every page (Q145 9: the job holds no page data). Null for a caller who owns no page (a co-editor included, E33).
create function public.owner_usage() returns jsonb
language sql stable security definer set search_path = '' as $$
  with page as (
    select p.id, p.storage_budget_bytes, p.created_at, p.timezone
    from public.memberships m join public.pages p on p.id = m.page_id
    where m.user_id = auth.uid() and m.role = 'owner'),
  attempt as (select r.finished_at, r.result from public.job_runs r order by r.finished_at desc, r.id desc limit 1),
  success as (
    select r.finished_at, coalesce(r.orphans, 0) + coalesce(r.resized, 0) as corrections from public.job_runs r
    where r.result = '200' order by r.finished_at desc, r.id desc limit 1)
  select jsonb_build_object(
    'total_bytes', public.storage_used(page.id),
    'budget_bytes', page.storage_budget_bytes,
    'uploading_bytes', coalesce((select sum(u.charged_bytes) from public.upload_reservations u where u.page_id = page.id), 0),
    'deleting_bytes', coalesce((select sum(d.bytes) from public.storage_deletions d where d.page_id = page.id and d.done_at is null), 0),
    'read_at', now(),
    'page_created_at', page.created_at,
    'timezone', page.timezone,
    'last_attempt_at', (select a.finished_at from attempt a),
    'last_attempt_result', (select a.result from attempt a),
    'last_success_at', (select s.finished_at from success s),
    'last_success_corrections', coalesce((select s.corrections from success s), 0),
    'has_run', exists (select 1 from attempt))
  from page
$$;

revoke all on function public.worker_job_record(timestamptz, text, int, int, int, int, int), public.health_ok(),
  public.owner_usage() from public;
grant execute on function public.worker_job_record(timestamptz, text, int, int, int, int, int), public.health_ok() to vegenus_server;
grant execute on function public.owner_usage() to authenticated;
