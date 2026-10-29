-- T1.4: login rate limit (design 3 §3.9, rate_limit_hits; E22). The login route runs on our server, so
-- the vendor's per-IP limit sees one address for everyone; these buckets use the caller's IP and address.
-- Keys are HMAC-SHA-256 values computed by the server with a server secret; no raw address or IP is stored.

create table public.rate_limit_hits (
  scope text not null,
  key_hash bytea not null check (octet_length(key_hash) = 32),
  window_start timestamptz not null,
  count int not null default 1,
  primary key (scope, key_hash, window_start)
);
alter table public.rate_limit_hits enable row level security;

-- ponytail: fixed 15-minute windows (an attacker gets at most 2x the limit across a boundary); sliding
-- windows if that matters. Every attempt counts, successful or not.
create function public.login_attempt(ip_key bytea, email_key bytea) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  win timestamptz := date_bin('15 minutes', now(), timestamptz '2000-01-01');
  ip_count int;
  email_count int;
begin
  if octet_length(ip_key) is distinct from 32 or octet_length(email_key) is distinct from 32 then
    raise exception 'login_attempt keys must be 32-byte HMACs' using errcode = '22023';
  end if;
  -- ponytail: expired login buckets are purged here until the daily job (T2.5) does it for every scope
  delete from public.rate_limit_hits where scope in ('login_ip', 'login_email') and window_start < win;
  insert into public.rate_limit_hits as h (scope, key_hash, window_start) values ('login_ip', ip_key, win)
    on conflict (scope, key_hash, window_start) do update set count = h.count + 1
    returning h.count into ip_count;
  -- A blocked IP stops here, so it cannot create address buckets (Codex, T1.4 review).
  if ip_count > 20 then
    return false;
  end if;
  insert into public.rate_limit_hits as h (scope, key_hash, window_start) values ('login_email', email_key, win)
    on conflict (scope, key_hash, window_start) do update set count = h.count + 1
    returning h.count into email_count;
  return ip_count <= 20 and email_count <= 5;
end
$$;

revoke all on function public.login_attempt(bytea, bytea) from public;
grant execute on function public.login_attempt(bytea, bytea) to vegenus_server;
