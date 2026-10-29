-- T1.5a: token exchange rate limit (design 1 §4 step 3, design 3 §3.9). The exchange route runs on our
-- server, so the vendor's per-IP limit sees one address for everyone; this bucket uses the caller's IP.
-- The key is an HMAC-SHA-256 the server computes with a server secret; no raw IP is stored.
-- 100 per IP per 15 minutes (owner, 2026-10-29): a crowd on one venue network exchanges once per phone (E46).

-- ponytail: fixed 15-minute windows like login_attempt (at most 2x the limit across a boundary)
create function public.guest_exchange_attempt(ip_key bytea) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  win timestamptz := date_bin('15 minutes', now(), timestamptz '2000-01-01');
  n int;
begin
  if octet_length(ip_key) is distinct from 32 then
    raise exception 'guest_exchange_attempt key must be a 32-byte HMAC' using errcode = '22023';
  end if;
  -- ponytail: expired buckets are purged here until the daily job (T2.5) does it for every scope
  delete from public.rate_limit_hits where scope = 'guest_exchange' and window_start < win;
  insert into public.rate_limit_hits as h (scope, key_hash, window_start) values ('guest_exchange', ip_key, win)
    on conflict (scope, key_hash, window_start) do update set count = h.count + 1
    returning h.count into n;
  return n <= 100;
end
$$;

revoke all on function public.guest_exchange_attempt(bytea) from public;
grant execute on function public.guest_exchange_attempt(bytea) to vegenus_server;
