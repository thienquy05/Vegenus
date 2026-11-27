-- Q152 (owner, 2026-11-26): a photo picked for Home is shown to guests whenever Home is published, also when its
-- memory is unpublished or the Memories section is off; only deleting the photo or removing the pick takes it away.
-- Replaces Q144 default 6 (a pick of an unpublished memory was hidden): the guest read drops the memory check and
-- the O17 read drops the `hidden` mark. The picker still offers photos of published memories only (Q144).

create or replace function public.home_shown_picks(page_id uuid) returns table (media_id uuid, pos smallint)
language sql stable set search_path = '' as $$
  select hp.media_id, hp.published_position
  from public.items h
  join public.home_picks hp on hp.item_id = h.id and hp.published_position is not null
  join public.media m on m.id = hp.media_id and m.state = 'ready' and m.kind = 'photo'
  where h.page_id = home_shown_picks.page_id and h.kind = 'home' and h.status = 'published'
    and public.page_is_live(home_shown_picks.page_id, 'home')
$$;

-- O17 and the O2 card: the page's Home with its draft picks in order, or null. unpublished_changes: the published
-- Home differs from the draft, picks included.
create or replace function public.owner_home_get() returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(i) - 'page_id' - 'created_by' - 'updated_by' || jsonb_build_object(
    'timezone', p.timezone,
    'unpublished_changes', i.published is not null and (i.published is distinct from public.item_snapshot(i)
      or exists (select 1 from public.home_picks hp where hp.item_id = i.id and hp.position is distinct from hp.published_position)),
    'picks', coalesce((
      select jsonb_agg(jsonb_build_object('media_id', m.id, 'item_id', m.item_id,
          'alt', m.alt, 'alt_alt', m.alt_alt, 'width', m.width, 'height', m.height,
          'preview', (select jsonb_build_object('bucket', v.bucket, 'path', v.path) from public.media_variants v
            where v.media_id = m.id and v.variant = 'thumb'))
        order by hp.position)
      from public.home_picks hp
      join public.media m on m.id = hp.media_id
      where hp.item_id = i.id and hp.position is not null), '[]'::jsonb))
  from public.items i
  join public.pages p on p.id = i.page_id
  where i.page_id = public.owner_page_id() and i.kind = 'home'
$$;
