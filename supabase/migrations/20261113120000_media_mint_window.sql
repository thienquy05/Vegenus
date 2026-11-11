-- T2.3b: a deadline for minting upload URLs (Codex review of T2.3b). The storage insert policy is checked when a
-- signed upload URL is minted, not when its token is used (verified against the local Storage service,
-- e2e/media-upload.spec.ts), and a token lasts 2 hours (Q135). Allowing minting until write_until let a token outlive
-- the deletion fence. Minting is now allowed for 5 minutes after Begin only, so every token expires before write_until
-- (Begin + 2 h 5 min) and therefore before its paths can be freed (write_until + 15 min). The upload route mints right
-- after Begin; this bound also holds for direct Storage requests.

create or replace function public.owner_upload_admitted(bucket text, path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.upload_reservations r
    join public.memberships m on m.page_id = r.page_id and m.user_id = auth.uid() and m.role = 'owner'
    cross join jsonb_array_elements(r.files) f
    where f ->> 'bucket' = owner_upload_admitted.bucket and f ->> 'path' = owner_upload_admitted.path
      and r.created_at + interval '5 minutes' > now())
$$;
