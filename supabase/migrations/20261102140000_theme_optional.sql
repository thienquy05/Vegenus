-- Q128 (T2.1b): guests choose the theme on their first visit, so pages.theme is only the owner's optional suggestion
-- (null: none). Setup no longer asks for one; owner_save_page is otherwise unchanged (its grants stay).
alter table public.pages alter column theme drop default, alter column theme drop not null;

create or replace function public.owner_save_page(
  expected_version int, theme public.theme_id, default_lang public.lang,
  label_a text, label_b text, timezone text, sections public.section_id[])
returns int
language plpgsql security definer set search_path = '' as $$
declare
  page uuid;
  saved int;
begin
  -- Closed registration (Q94): any signed-in account may create its page; a co-editor (reserved, Q35) may not.
  if auth.uid() is null
    or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.role <> 'owner') then
    raise exception 'not allowed to set up a page' using errcode = '42501';
  end if;
  if owner_save_page.default_lang is null or owner_save_page.sections is null
    or not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = owner_save_page.timezone) then
    raise exception 'owner_save_page needs a language, sections and a known time zone' using errcode = '22023';
  end if;
  -- Names fill single-line wording (editable wording §2.2 rule 2); the table checks NFC and 1-40 characters.
  if owner_save_page.label_a ~ '[\x01-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]|^\s|\s$'
    or owner_save_page.label_b ~ '[\x01-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]|^\s|\s$' then
    raise exception 'a name has a control character or a space at either end' using errcode = '22023';
  end if;

  select m.page_id into page from public.memberships m where m.user_id = auth.uid() and m.role = 'owner';
  if page is null then
    if owner_save_page.expected_version is not null then
      return null; -- the screen knew a page that is gone
    end if;
    insert into public.pages (theme, default_lang, label_a, label_b, timezone)
      values (owner_save_page.theme, owner_save_page.default_lang, owner_save_page.label_a,
        owner_save_page.label_b, owner_save_page.timezone)
      returning id, version into page, saved;
    insert into public.memberships (page_id, user_id, role) values (page, auth.uid(), 'owner');
  else
    -- Setup choices of a finished page change elsewhere once Q115 decides where (Q114). The row lock first, so a
    -- Finish cannot commit between this check and the update, whatever version the caller names.
    perform 1 from public.pages p where p.id = page for update;
    if exists (select 1 from public.pages p where p.id = page and p.setup_completed_at is not null) then
      raise exception 'setup is finished' using errcode = '55000';
    end if;
    update public.pages p set theme = owner_save_page.theme, default_lang = owner_save_page.default_lang,
        label_a = owner_save_page.label_a, label_b = owner_save_page.label_b, timezone = owner_save_page.timezone
      where p.id = page and p.version = owner_save_page.expected_version
      returning p.version into saved;
    if not found then
      return null; -- another session saved first (E15)
    end if;
  end if;
  -- Home is every guest's landing (screens flow 1), so it is always on (Q118).
  update public.page_sections s set enabled = s.section = 'home' or s.section = any (owner_save_page.sections)
    where s.page_id = page;
  return saved;
exception when unique_violation then
  return null; -- another session created the page first (memberships_one_page_per_owner)
end
$$;
