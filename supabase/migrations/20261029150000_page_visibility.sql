-- T1.5c: the owner's visibility switch (design 1 §6, §10.1; design 3 §3.1, §3.12). E4, E33, E47.
-- Guest and public reads already re-check visibility through page_is_live and published_page, so the
-- new state applies on the next request. The O9 confirm for Private and Published is the route's
-- (src/app/api/owner/visibility/route.ts). Decided with the owner 2026-10-29: no version check (the last
-- choice wins; the version trigger comes with the first edit that checks versions), and Published is
-- allowed without a vanity name (the public route that needs one comes in Phase 3).

-- ponytail: one page per owner (tenancy deferred, Q84); takes a page id when an owner can have several
create function public.owner_set_visibility(visibility public.visibility) returns void
language plpgsql security definer set search_path = '' as $$
declare
  page uuid;
begin
  if owner_set_visibility.visibility is null then
    raise exception 'owner_set_visibility needs a visibility' using errcode = '22023';
  end if;
  select m.page_id into page from public.memberships m where m.user_id = auth.uid() and m.role = 'owner';
  if page is null then
    raise exception 'not the owner of a page' using errcode = '42501';
  end if;
  -- Under the page row lock, so the wording check and the change cannot interleave with a publication.
  perform 1 from public.pages p where p.id = page for update;
  -- A page cannot be shown to guests before its first wording publication (design 3 §3.12).
  if owner_set_visibility.visibility <> 'private'
    and (select p.copy_published_at from public.pages p where p.id = page) is null then
    raise exception 'the wording is not published yet' using errcode = '55000';
  end if;
  update public.pages p set visibility = owner_set_visibility.visibility, updated_at = now() where p.id = page;
end
$$;

revoke all on function public.owner_set_visibility(public.visibility) from public;
grant execute on function public.owner_set_visibility(public.visibility) to authenticated;
