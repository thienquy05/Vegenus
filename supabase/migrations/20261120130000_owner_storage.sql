-- O6 Upload shows the page's storage from the server, never an estimate (owner UI "O6 Upload"; Q66, Q139): owner_page
-- adds the bytes the page uses (storage_used: stored files, open reservations and deletions not yet done) and its
-- budget. Same signature, so its grants stay.
create or replace function public.owner_page() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'version', p.version, 'theme', p.theme, 'default_lang', p.default_lang,
    'label_a', p.label_a, 'label_b', p.label_b, 'timezone', p.timezone,
    'visibility', p.visibility, 'setup_completed', p.setup_completed_at is not null,
    'sections', coalesce((
      select jsonb_agg(s.section order by s.sort_order) from public.page_sections s
      where s.page_id = p.id and s.enabled), '[]'::jsonb),
    'storage_used_bytes', public.storage_used(p.id), 'storage_budget_bytes', p.storage_budget_bytes)
  from public.memberships m join public.pages p on p.id = m.page_id
  where m.user_id = auth.uid() and m.role = 'owner'
$$;
