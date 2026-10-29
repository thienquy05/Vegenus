-- Login rate limit (T1.4; design 3 §3.9, rate_limit_hits; E22): only vegenus_server counts attempts,
-- per address and per IP, keyed by 32-byte HMACs the server computes (no raw address or IP is stored).
begin;
select plan(14);

select throws_ok($$ set local role anon; select public.login_attempt('\x00'::bytea, '\x00'::bytea) $$,
  '42501', null, 'anon cannot call login_attempt');
reset role;
select throws_ok($$ set local role authenticated; select public.login_attempt('\x00'::bytea, '\x00'::bytea) $$,
  '42501', null, 'authenticated cannot call login_attempt');
reset role;

-- SECURITY DEFINER: the counting below behaves the same for any caller allowed to execute it.
select ok(has_function_privilege('vegenus_server', 'public.login_attempt(bytea, bytea)', 'execute'),
  'vegenus_server can call login_attempt');

select is((select array_agg(public.login_attempt(sha256('ip-a'), sha256('mail-a'))) from generate_series(1, 5)),
  array[true, true, true, true, true], 'five attempts for one address are allowed');
select is(public.login_attempt(sha256('ip-b'), sha256('mail-a')), false,
  'the sixth attempt for that address is refused, from any IP');
select is(public.login_attempt(sha256('ip-b'), sha256('mail-b')), true,
  'another address is not affected');

-- 20 per IP: ip-c has used none; spread over addresses so the address limit is not what trips.
select is((select bool_and(public.login_attempt(sha256('ip-c'), sha256(convert_to('mail-c' || i, 'UTF8')))) from generate_series(1, 20) i),
  true, 'twenty attempts from one IP over different addresses are allowed');
select is(public.login_attempt(sha256('ip-c'), sha256('mail-new')), false, 'the 21st from that IP is refused');

-- Codex, T1.4 review: a blocked IP must not keep creating address buckets (storage growth).
select is((select count(*) from public.rate_limit_hits where scope = 'login_email' and key_hash = sha256('mail-new2')), 0::bigint,
  'precondition: no bucket for a new address');
select is(public.login_attempt(sha256('ip-c'), sha256('mail-new2')), false, 'a blocked IP is refused for a new address');
select is((select count(*) from public.rate_limit_hits where scope = 'login_email' and key_hash = sha256('mail-new2')), 0::bigint,
  'and no address bucket was created for it');

-- Expired buckets are removed as the limiter runs (the daily job of T2.5 takes over later).
insert into public.rate_limit_hits (scope, key_hash, window_start) values ('login_ip', sha256('old'), now() - interval '1 hour');
select public.login_attempt(sha256('ip-d'), sha256('mail-d'));
select is((select count(*) from public.rate_limit_hits where key_hash = sha256('old')), 0::bigint, 'an expired login bucket is deleted');

select throws_ok($$ select public.login_attempt('\x01'::bytea, sha256('x')) $$,
  '22023', null, 'a key that is not a 32-byte HMAC is refused');

select is((select count(*) from public.rate_limit_hits where octet_length(key_hash) <> 32), 0::bigint,
  'every stored key is 32 bytes');

select * from finish();
rollback;
