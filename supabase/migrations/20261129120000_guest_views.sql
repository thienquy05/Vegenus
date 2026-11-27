-- T3.1a: the guest views read path (design 1 §5; design 3 §3.3, §3.12; guest UI §6, §12; PRD Q29, Q144; E5, E6,
-- E13, E56). The page summary of every open call now carries what G1-G8 show: the partner names, the time zone, the
-- published wording in both languages and the published Home with its guest-visible picks. List rows carry their
-- ready media; get_item reads one item for G3; page_media returns the storage paths of media a guest may see, which
-- the server signs for 5 minutes (Q29). Postgres cannot sign Storage URLs, so the signing stays in one server module
-- (owner, 2026-11-26; design 7 §3).

-- A Home pick guests see: Home published in an enabled Home section, a ready photo whose memory is published. The
-- Memories section need not be enabled: the couple chose the photo for Home (Claude's default, 2026-11-26).
create function public.home_shown_picks(page_id uuid) returns table (media_id uuid, pos smallint)
language sql stable set search_path = '' as $$
  select hp.media_id, hp.published_position
  from public.items h
  join public.home_picks hp on hp.item_id = h.id and hp.published_position is not null
  join public.media m on m.id = hp.media_id and m.state = 'ready' and m.kind = 'photo'
  join public.items mi on mi.id = m.item_id and mi.status = 'published'
  where h.page_id = home_shown_picks.page_id and h.kind = 'home' and h.status = 'published'
    and public.page_is_live(home_shown_picks.page_id, 'home')
$$;

-- The ready media of an item, in order: what G2, G3 and G4 show (no paths; the server signs those on request).
create function public.item_media(item_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'width', m.width, 'height', m.height,
      'duration_ms', m.duration_ms, 'alt', m.alt, 'alt_alt', m.alt_alt) order by m.position, m.id), '[]'::jsonb)
  from public.media m where m.item_id = item_media.item_id and m.state = 'ready'
$$;

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
          select jsonb_agg(jsonb_build_object('id', m.id, 'alt', m.alt, 'alt_alt', m.alt_alt, 'width', m.width,
              'height', m.height) order by s.pos)
          from public.home_shown_picks(p.id) s join public.media m on m.id = s.media_id), '[]'::jsonb))
      from public.items h
      where h.page_id = p.id and h.kind = 'home' and h.status = 'published' and public.page_is_live(p.id, 'home')))
  from public.pages p
  where p.id = page_summary.page_id and public.page_is_live(p.id)
$$;

alter type public.item_view add attribute media jsonb;

create or replace function public.list_items(page_id uuid, section public.section_id, after_sort numeric, after_id uuid)
returns setof public.item_view
language sql stable set search_path = '' as $$
  select i.id, i.kind, s.lang, s.title, s.body, s.lang_alt, s.title_alt, s.body_alt,
    s.event_date, s.date_precision, s.recurs_yearly, s.start_date, s.zodiac_system, s.zodiac_key, i.sort_order,
    public.item_media(i.id)
  from public.items i
  cross join lateral jsonb_populate_record(null::public.item_view, i.published) s
  where public.page_is_live(list_items.page_id, list_items.section)
    and i.page_id = list_items.page_id and i.section = list_items.section and i.status = 'published'
    and (list_items.after_id is null or (i.sort_order, i.id) > (list_items.after_sort, list_items.after_id))
  order by i.sort_order, i.id
  limit 50
$$;

-- G3: one published item of the page in an enabled section. Home is read through the summary only.
create function public.get_item(page_id uuid, item_id uuid) returns setof public.item_view
language sql stable set search_path = '' as $$
  select i.id, i.kind, s.lang, s.title, s.body, s.lang_alt, s.title_alt, s.body_alt,
    s.event_date, s.date_precision, s.recurs_yearly, s.start_date, s.zodiac_system, s.zodiac_key, i.sort_order,
    public.item_media(i.id)
  from public.items i
  cross join lateral jsonb_populate_record(null::public.item_view, i.published) s
  where i.id = get_item.item_id and i.page_id = get_item.page_id and i.status = 'published' and i.kind <> 'home'
    and public.page_is_live(get_item.page_id, i.section)
$$;

-- The files a guest may load: ready media of a published item in an enabled section, or a shown Home pick. Never the
-- full-size original. Ids that do not qualify are left out, so an id reveals nothing (E56).
create function public.page_media(page_id uuid, ids uuid[], variant public.media_variant)
returns table (media_id uuid, bucket text, path text)
language sql stable set search_path = '' as $$
  select v.media_id, v.bucket, v.path
  from public.media m
  join public.media_variants v on v.media_id = m.id and v.variant = page_media.variant
  where m.page_id = page_media.page_id and m.id = any (page_media.ids) and m.state = 'ready'
    and page_media.variant <> 'full'
    and (exists (
        select 1 from public.items i
        where i.id = m.item_id and i.page_id = m.page_id and i.status = 'published' and i.kind <> 'home'
          and public.page_is_live(m.page_id, i.section))
      or m.id in (select s.media_id from public.home_shown_picks(m.page_id) s))
$$;

create function public.guest_item(token text, item_id uuid) returns setof public.item_view
language sql stable security definer set search_path = '' as $$
  select * from public.get_item(public.token_page(guest_item.token), guest_item.item_id)
$$;

create function public.guest_media(token text, ids uuid[], variant public.media_variant)
returns table (media_id uuid, bucket text, path text)
language plpgsql stable security definer set search_path = '' as $$
begin
  -- A screen asks for at most one list page (50) plus the Home picks (7).
  if cardinality(guest_media.ids) > 100 then
    raise exception 'guest_media takes at most 100 ids' using errcode = '22023';
  end if;
  return query select * from public.page_media(public.token_page(guest_media.token), guest_media.ids, guest_media.variant);
end
$$;

revoke all on function
  public.home_shown_picks(uuid), public.item_media(uuid), public.get_item(uuid, uuid),
  public.page_media(uuid, uuid[], public.media_variant),
  public.guest_item(text, uuid), public.guest_media(text, uuid[], public.media_variant)
from public;
grant execute on function public.guest_item(text, uuid), public.guest_media(text, uuid[], public.media_variant) to anon;
