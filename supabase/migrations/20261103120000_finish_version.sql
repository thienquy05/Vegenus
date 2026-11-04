-- Finish names the version the review showed, like every step save (E15, Q114): a save from another session after
-- the review is a conflict, not a publication. Otherwise unchanged from wording_core, apart from the step number.
drop function public.owner_copy_accept_defaults(public.visibility);

create function public.owner_copy_accept_defaults(visibility public.visibility, expected_version int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  page uuid;
  p public.pages;
begin
  select m.page_id into page from public.memberships m where m.user_id = auth.uid() and m.role = 'owner';
  if page is null then
    raise exception 'not the owner of a page' using errcode = '42501';
  end if;
  -- shortcut: Token-only only (Q114); Published waits for the Phase 3 public route and its O9 confirm.
  if owner_copy_accept_defaults.visibility is distinct from 'token_only' then
    raise exception 'setup finishes as Token-only' using errcode = '22023';
  end if;
  select * into p from public.pages where id = page for update;
  -- Before the version check: a retry of a Finish that committed must answer "already set up".
  if p.copy_published_at is not null then
    raise exception 'setup is finished' using errcode = '55000';
  end if;
  if p.version is distinct from owner_copy_accept_defaults.expected_version then
    raise exception 'the page changed after the review' using errcode = '22023';
  end if;
  -- The examples use {partner_a} and {partner_b}, so both names come first (O3 step 1, Q121).
  if p.label_a is null or p.label_b is null then
    raise exception 'both names are needed' using errcode = '22023';
  end if;
  if exists (select 1 from public.page_copy c where c.page_id = page and c.draft_text is null) then
    raise exception 'a wording field is empty' using errcode = '22023';
  end if;
  update public.page_copy c set published_text = c.draft_text where c.page_id = page;
  update public.pages set visibility = owner_copy_accept_defaults.visibility, copy_published_rev = copy_draft_rev,
      copy_published_at = now(), setup_completed_at = now()
    where id = page;
end
$$;
revoke all on function public.owner_copy_accept_defaults(public.visibility, int) from public;
grant execute on function public.owner_copy_accept_defaults(public.visibility, int) to authenticated;
