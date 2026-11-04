-- T2.1b: the setup wizard's wording step (O3 step 4, Q124) shows the drafted wording Finish will publish.
-- The caller's drafts as {key: {en, vi}}, tokens unfilled, or null: no page, or not its owner (like owner_page).
create function public.owner_copy_drafts() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_object_agg(k.key, (
      select jsonb_object_agg(c.lang, c.draft_text) from public.page_copy c where c.page_id = m.page_id and c.key = k.key))
  from public.memberships m cross join public.copy_keys k
  where m.user_id = auth.uid() and m.role = 'owner'
$$;

revoke all on function public.owner_copy_drafts() from public;
grant execute on function public.owner_copy_drafts() to authenticated;
