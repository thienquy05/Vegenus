-- T1.5b: create or rotate the guest token (design 1 §3.1, §3.2, §6; design 3 §3.2, §5). E3, E33.
-- The database draws the token, so no caller can choose a weak one; only its SHA-256 is stored and the
-- raw value is returned once (Q34a). The old token and every cookie holding it fail on the next request,
-- because guest_open re-checks the hash. Pending wishes keep their token_version; nothing here touches them.
-- shown_at ("link not shown yet", Rotate again) is set by the Share screen O8 (T2.6).

-- The token's random bytes. Supabase ships pgcrypto in `extensions`; declared so no project relies on that.
create extension if not exists pgcrypto with schema extensions;

-- ponytail: one page per owner (tenancy deferred, Q84); takes a page id when an owner can have several
create function public.owner_rotate_token(request_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  page uuid;
  token text;
begin
  if owner_rotate_token.request_id is null then
    raise exception 'owner_rotate_token needs a request id' using errcode = '22023';
  end if;
  select m.page_id into page from public.memberships m where m.user_id = auth.uid() and m.role = 'owner';
  if page is null then
    raise exception 'not the owner of a page' using errcode = '42501';
  end if;
  -- Rotations of one page run one after another, so a retry sees the first and two at once leave one active token.
  perform 1 from public.pages p where p.id = page for update;
  if exists (select 1 from public.guest_tokens t where t.request_id = owner_rotate_token.request_id) then
    return null; -- already rotated: the link is never shown again
  end if;

  token := translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_');
  update public.guest_tokens t set active = false, deactivated_at = now() where t.page_id = page and t.active;
  insert into public.guest_tokens (page_id, version, token_hash, request_id, created_by)
    select page, coalesce(max(t.version), 0) + 1, sha256(convert_to(token, 'UTF8')), owner_rotate_token.request_id, auth.uid()
    from public.guest_tokens t where t.page_id = page;
  return token;
end
$$;

revoke all on function public.owner_rotate_token(uuid) from public;
grant execute on function public.owner_rotate_token(uuid) to authenticated;
