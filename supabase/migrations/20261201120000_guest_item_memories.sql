-- T3.1c review: G3 (the memory album) reads memories only. A Together place has its sheet in G4; by URL it is not found,
-- and with Memories off no item opens in G3.
create or replace function public.get_item(page_id uuid, item_id uuid) returns setof public.item_view
language sql stable set search_path = '' as $$
  select i.id, i.kind, s.lang, s.title, s.body, s.lang_alt, s.title_alt, s.body_alt,
    s.event_date, s.date_precision, s.recurs_yearly, s.start_date, s.zodiac_system, s.zodiac_key, i.sort_order,
    public.item_media(i.id)
  from public.items i
  cross join lateral jsonb_populate_record(null::public.item_view, i.published) s
  where i.id = get_item.item_id and i.page_id = get_item.page_id and i.status = 'published' and i.section = 'memories'
    and public.page_is_live(get_item.page_id, 'memories')
$$;
