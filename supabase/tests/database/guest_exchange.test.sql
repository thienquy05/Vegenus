-- Token exchange rate limit (T1.5a; design 1 §4 step 3, design 3 §3.9): only vegenus_server counts
-- exchanges per IP, keyed by a 32-byte HMAC the server computes. 100 per IP per 15 minutes (owner,
-- 2026-10-29): a crowd on one venue network exchanges once per phone (E46).
begin;
select plan(8);

select throws_ok($$ set local role anon; select public.guest_exchange_attempt('\x00'::bytea) $$,
  '42501', null, 'anon cannot call guest_exchange_attempt');
reset role;
select throws_ok($$ set local role authenticated; select public.guest_exchange_attempt('\x00'::bytea) $$,
  '42501', null, 'authenticated cannot call guest_exchange_attempt');
reset role;

select ok(has_function_privilege('vegenus_server', 'public.guest_exchange_attempt(bytea)', 'execute'),
  'vegenus_server can call guest_exchange_attempt');

select is((select bool_and(public.guest_exchange_attempt(sha256('ip-a'))) from generate_series(1, 100)),
  true, 'one hundred exchanges from one IP are allowed');
select is(public.guest_exchange_attempt(sha256('ip-a')), false, 'the 101st from that IP is refused');
select is(public.guest_exchange_attempt(sha256('ip-b')), true, 'another IP is not affected');

-- Expired buckets are removed as the limiter runs (the daily job of T2.5 takes over later).
insert into public.rate_limit_hits (scope, key_hash, window_start) values ('guest_exchange', sha256('old'), now() - interval '1 hour');
select public.guest_exchange_attempt(sha256('ip-c'));
select is((select count(*) from public.rate_limit_hits where key_hash = sha256('old')), 0::bigint, 'an expired exchange bucket is deleted');

select throws_ok($$ select public.guest_exchange_attempt('\x01'::bytea) $$,
  '22023', null, 'a key that is not a 32-byte HMAC is refused');

select * from finish();
rollback;
