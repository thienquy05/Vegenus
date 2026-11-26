-- T2.8a: the page settings save O19 needs (owner UI "O19 Page settings"; PRD Q115). One call per panel (names and
-- default language, time zone, suggested theme) that a finished page accepts. It sends only the touched fields, each
-- with the saved value it was edited against; a moved saved value answers null ("conflict"). The request id is
-- recorded under the page lock as the O9 saves do (settings_saves gains a kind per panel), so a retry of a committed
-- save answers the owner_page() snapshot without applying twice.

alter table public.settings_saves drop constraint settings_saves_kind_check;
alter table public.settings_saves add constraint settings_saves_kind_check
  check (kind in ('visibility', 'sections', 'names', 'timezone', 'theme'));

-- Answers the snapshot, null (conflict), or {error: invalid_timezone | wording_incomplete}; raises 55000 before Finish
-- (the wizard owns these choices) and 22023 on a malformed call. Names and the default language commit together.
-- ponytail: one page per owner (tenancy deferred, Q84); takes a page id when an owner can have several
create function public.owner_save_settings(panel text, base jsonb, fields jsonb, request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  page uuid;
  allowed text[] := case owner_save_settings.panel when 'names' then array['label_a', 'label_b', 'default_lang']
    when 'timezone' then array['timezone'] when 'theme' then array['theme'] end;
  keys text[];
  saved jsonb;
begin
  if allowed is null or owner_save_settings.request_id is null
    or jsonb_typeof(owner_save_settings.base) is distinct from 'object'
    or jsonb_typeof(owner_save_settings.fields) is distinct from 'object' then
    raise exception 'owner_save_settings needs a panel, base and fields objects and a request id' using errcode = '22023';
  end if;
  select array_agg(k order by k) into keys from jsonb_object_keys(owner_save_settings.fields) k;
  if keys is null or not keys <@ allowed
    or keys is distinct from (select array_agg(k order by k) from jsonb_object_keys(owner_save_settings.base) k)
    -- Only the theme may be null (No suggestion).
    or exists (select 1 from jsonb_each(owner_save_settings.fields) f where f.key <> 'theme' and jsonb_typeof(f.value) <> 'string')
    or (owner_save_settings.fields ->> 'label_a') ~ '[\x01-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]|^\s|\s$'
    or (owner_save_settings.fields ->> 'label_b') ~ '[\x01-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]|^\s|\s$' then
    raise exception 'owner_save_settings needs the panel''s fields, each with its base, and valid names' using errcode = '22023';
  end if;
  select m.page_id into page from public.memberships m where m.user_id = auth.uid() and m.role = 'owner';
  if page is null then
    raise exception 'not the owner of a page' using errcode = '42501';
  end if;
  perform 1 from public.pages p where p.id = page for update;
  if exists (select 1 from public.settings_saves s where s.page_id = page and s.kind = owner_save_settings.panel
      and s.request_id = owner_save_settings.request_id) then
    return public.owner_page();
  end if;
  select jsonb_build_object('label_a', p.label_a, 'label_b', p.label_b, 'default_lang', p.default_lang,
      'timezone', p.timezone, 'theme', p.theme, 'finished', p.setup_completed_at is not null)
    into saved from public.pages p where p.id = page;
  if not (saved ->> 'finished')::boolean then
    raise exception 'setup is not finished' using errcode = '55000';
  end if;
  if exists (select 1 from unnest(keys) k where saved -> k is distinct from owner_save_settings.base -> k) then
    return null; -- saved elsewhere since the draft's read
  end if;
  if owner_save_settings.fields ? 'timezone' and not exists (
      select 1 from pg_catalog.pg_timezone_names z where z.name = owner_save_settings.fields ->> 'timezone') then
    return jsonb_build_object('error', 'invalid_timezone');
  end if;

  begin
    update public.pages p set
      label_a = case when keys @> array['label_a'] then owner_save_settings.fields ->> 'label_a' else p.label_a end,
      label_b = case when keys @> array['label_b'] then owner_save_settings.fields ->> 'label_b' else p.label_b end,
      default_lang = case when keys @> array['default_lang'] then (owner_save_settings.fields ->> 'default_lang')::public.lang
        else p.default_lang end,
      timezone = case when keys @> array['timezone'] then owner_save_settings.fields ->> 'timezone' else p.timezone end,
      theme = case when keys @> array['theme'] then (owner_save_settings.fields ->> 'theme')::public.theme_id else p.theme end
    where p.id = page;
  exception when sqlstate '55000' then
    -- pages_wording_guard refuses a default language incomplete in the published wording. Any other 55000 is raised
    -- as P0001: no other panel gets a refusal naming the language, and the route answers an unknown outcome (503)
    -- rather than "setup not finished".
    if not keys @> array['default_lang'] then
      raise exception '%', sqlerrm using errcode = 'P0001';
    end if;
    return jsonb_build_object('error', 'wording_incomplete');
  end;
  insert into public.settings_saves (page_id, kind, request_id) values (page, owner_save_settings.panel, owner_save_settings.request_id);
  return public.owner_page();
end
$$;

revoke all on function public.owner_save_settings(text, jsonb, jsonb, uuid) from public;
grant execute on function public.owner_save_settings(text, jsonb, jsonb, uuid) to authenticated;
