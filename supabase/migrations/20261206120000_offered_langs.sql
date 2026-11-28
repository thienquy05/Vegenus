-- Offered languages (T3.3; editable copy §4 "Language availability"; data model §3.12; E54). page_summary, and so
-- guest_open and public_open, also returns `languages_ready`: the languages whose keys all have published text, in
-- enum order. The default language is always among them (pages_wording_guard). The guest shell picks among these (the
-- saved choice, else the phone's, else the default) and shows the others disabled in G8.
create or replace function public.page_summary(page_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'theme', p.theme,
    'default_lang', p.default_lang,
    'sections', coalesce((
      select jsonb_agg(s.section order by s.sort_order) from public.page_sections s
      where s.page_id = p.id and s.enabled), '[]'::jsonb),
    'names', jsonb_build_array(p.label_a, p.label_b),
    'timezone', p.timezone,
    'languages_ready', (
      select coalesce(jsonb_agg(l order by l), '[]'::jsonb) from unnest(enum_range(null::public.lang)) l
      where (select count(*) from public.page_copy pc where pc.page_id = p.id and pc.lang = l and pc.published_text is not null)
        = (select count(*) from public.copy_keys)),
    -- Only the published snapshot (Q82): {key: {en, vi}}, a language absent where it is not set.
    'copy', coalesce((
      select jsonb_object_agg(c.key, c.texts) from (
        select pc.key, jsonb_object_agg(pc.lang, pc.published_text) texts from public.page_copy pc
        where pc.page_id = p.id and pc.published_text is not null group by pc.key) c), '{}'::jsonb),
    'home', (
      select jsonb_build_object('lang', h.published -> 'lang', 'body', h.published -> 'body',
        'lang_alt', h.published -> 'lang_alt', 'body_alt', h.published -> 'body_alt',
        'start_date', h.published -> 'start_date',
        'picks', coalesce((
          select jsonb_agg(jsonb_build_object('id', m.id, 'alt', m.alt, 'alt_alt', m.alt_alt, 'lang', mi.lang,
              'lang_alt', mi.lang_alt, 'width', m.width, 'height', m.height) order by s.pos)
          from public.home_shown_picks(p.id) s
          join public.media m on m.id = s.media_id
          join public.items mi on mi.id = m.item_id), '[]'::jsonb))
      from public.items h
      where h.page_id = p.id and h.kind = 'home' and h.status = 'published' and public.page_is_live(p.id, 'home')))
  from public.pages p
  where p.id = page_summary.page_id and public.page_is_live(p.id)
$$;
