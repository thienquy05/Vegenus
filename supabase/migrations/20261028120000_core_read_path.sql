-- T1.3: core tables, deny-by-default access and the guest/public read path.
-- Contract: design 3 §3.1-§3.3, §3.5, §3.9, §3.12, §5, §6; design 1 §5. No table is granted to anon or
-- authenticated; guests read only through the guest_* and public_* functions at the end of this file.
-- Later units add: owner policies and functions (T1.4, T1.5), media and *_media_url (T2.3),
-- account_* and guestbook_entries.account_id (T3.6), wording tables (T2.7).

-- Supabase grants new tables and functions in public to anon and authenticated by default; turn that off.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
-- PostgreSQL also lets PUBLIC execute every new function; that default can only be revoked globally (no IN SCHEMA).
alter default privileges revoke execute on functions from public;

-- Server-only role for guest writes without a verified identity (design 3 §3.9). No login here: the
-- password is set per environment by hand (ALTER ROLE ... LOGIN PASSWORD), never in Git.
create role vegenus_server nologin noinherit;

create type public.theme_id as enum ('a_dreamy', 'b_cosmic', 'c_cozy', 'd_elegant');
create type public.lang as enum ('en', 'vi');
create type public.visibility as enum ('private', 'token_only', 'published');
create type public.section_id as enum ('home', 'memories', 'together', 'guestbook', 'zodiac');
create type public.owner_role as enum ('owner', 'co_editor');
create type public.item_kind as enum ('home', 'memory', 'milestone', 'anniversary', 'zodiac_sign');
create type public.pub_status as enum ('draft', 'published');
create type public.date_precision as enum ('day', 'month', 'year');
create type public.zodiac_system as enum ('western', 'vietnamese');
create type public.entry_status as enum ('pending', 'approved', 'rejected');
create type public.author_kind as enum ('token', 'account', 'visitor');

-- 3.1 Pages and sections

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  theme public.theme_id not null,
  default_lang public.lang not null,
  visibility public.visibility not null default 'private',
  label_a text check (label_a is nfc normalized and char_length(label_a) between 1 and 40),
  label_b text check (label_b is nfc normalized and char_length(label_b) between 1 and 40),
  copy_draft_rev int not null default 0,
  copy_published_rev int not null default 0,
  copy_published_at timestamptz,
  timezone text not null,
  vanity_name text unique,
  setup_completed_at timestamptz,
  version int not null default 1,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.page_sections (
  page_id uuid not null references public.pages on delete cascade,
  section public.section_id not null,
  enabled boolean not null default false,
  sort_order smallint not null,
  created_at timestamptz not null default now(),
  primary key (page_id, section)
);

-- All five sections exist from the start, disabled (PRD §4.1), so "enabled" is never inferred from a missing row.
create function public.seed_page_sections() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into public.page_sections (page_id, section, sort_order)
  select new.id, s, n from unnest(enum_range(null::public.section_id)) with ordinality as t(s, n);
  return new;
end
$$;

create trigger pages_seed_sections after insert on public.pages
  for each row execute function public.seed_page_sections();

-- 3.2 Owner accounts and guest tokens

create table public.memberships (
  page_id uuid not null references public.pages on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role public.owner_role not null,
  created_at timestamptz not null default now(),
  primary key (page_id, user_id)
);
create unique index memberships_one_owner on public.memberships (page_id) where role = 'owner';

create table public.guest_tokens (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages on delete cascade,
  version int not null check (version > 0),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  active boolean not null default true,
  request_id uuid not null unique,
  shown_at timestamptz,
  deactivated_at timestamptz,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (page_id, version)
);
create unique index guest_tokens_one_active on public.guest_tokens (page_id) where active;

-- 3.3 Content

create table public.items (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages on delete cascade,
  kind public.item_kind not null,
  section public.section_id not null generated always as (
    case kind
      when 'home' then 'home'::public.section_id
      when 'memory' then 'memories'::public.section_id
      when 'zodiac_sign' then 'zodiac'::public.section_id
      else 'together'::public.section_id
    end) stored,
  status public.pub_status not null default 'draft',
  published_at timestamptz,
  lang public.lang not null,
  title text not null check (title is nfc normalized and char_length(title) between 1 and 120),
  body text check (body is nfc normalized and char_length(body) <= 5000),
  lang_alt public.lang,
  title_alt text check (title_alt is nfc normalized and char_length(title_alt) between 1 and 120),
  body_alt text check (body_alt is nfc normalized and char_length(body_alt) <= 5000),
  event_date date,
  date_precision public.date_precision,
  recurs_yearly boolean not null default false,
  remind_owner boolean not null default false,
  start_date date,
  zodiac_system public.zodiac_system,
  zodiac_key text check (zodiac_key ~ '^[a-z_]{1,20}$'),
  sort_order numeric not null default 0,
  version int not null default 1,
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users on delete set null,
  updated_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (id, page_id),
  unique (page_id, zodiac_system, zodiac_key),
  -- Second language: all null, or lang_alt set and different from lang (E13).
  constraint items_alt_lang check (
    (lang_alt is null and title_alt is null and body_alt is null) or (lang_alt is not null and lang_alt <> lang)),
  -- Dates of month or year precision are stored as the first day of the period.
  constraint items_date_precision check (
    date_precision is null
    or (event_date is not null and (date_precision = 'day'
      or (date_precision = 'month' and extract(day from event_date) = 1)
      or (date_precision = 'year' and extract(day from event_date) = 1 and extract(month from event_date) = 1)))),
  -- Per-kind fields (design 3 §3.3).
  constraint items_kind_fields check (case kind
    when 'home' then event_date is null and date_precision is null and zodiac_system is null and zodiac_key is null
      and not recurs_yearly and not remind_owner
    when 'memory' then event_date is not null and date_precision is not null and start_date is null
      and zodiac_system is null and zodiac_key is null and not recurs_yearly and not remind_owner
    when 'milestone' then event_date is not null and date_precision is not null and start_date is null
      and zodiac_system is null and zodiac_key is null and not recurs_yearly and not remind_owner
    when 'anniversary' then event_date is not null and date_precision is not distinct from 'day' and start_date is null
      and zodiac_system is null and zodiac_key is null
    when 'zodiac_sign' then zodiac_system is not null and zodiac_key is not null and event_date is null
      and date_precision is null and start_date is null and not recurs_yearly and not remind_owner
  end)
);
create unique index items_one_home on public.items (page_id) where kind = 'home';
create index items_guest_list on public.items (page_id, section, status, sort_order, id);

-- 3.5 Guestbook

create table public.guestbook_entries (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages on delete cascade,
  display_name text not null check (display_name is nfc normalized and char_length(display_name) between 1 and 40),
  body text not null check (body is nfc normalized and char_length(body) between 1 and 500),
  lang public.lang not null,
  status public.entry_status not null default 'pending',
  submission_id uuid not null,
  author_kind public.author_kind not null,
  token_version int check ((author_kind = 'token') = (token_version is not null)),
  moderated_at timestamptz,
  moderated_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (page_id, submission_id)
);
create index guestbook_approved on public.guestbook_entries (page_id, status, created_at desc, id);
create index guestbook_pending on public.guestbook_entries (page_id, created_at) where status = 'pending';

-- Deny by default: RLS on, no policies yet. Owner policies come with owner auth (T1.4, T1.5).
alter table public.pages enable row level security;
alter table public.page_sections enable row level security;
alter table public.memberships enable row level security;
alter table public.guest_tokens enable row level security;
alter table public.items enable row level security;
alter table public.guestbook_entries enable row level security;

-- Read path helpers. Not executable by any API role; the definer functions below call them.

-- The page of an active token, or null (design 1 §3: only the SHA-256 of the token is stored).
create function public.token_page(token text) returns uuid
language sql stable set search_path = '' as $$
  select t.page_id from public.guest_tokens t
  where t.token_hash = sha256(convert_to(token_page.token, 'UTF8')) and t.active
$$;

-- A Published page by its vanity name, or null (design 1 §10.2).
create function public.published_page(page_selector text) returns uuid
language sql stable set search_path = '' as $$
  select p.id from public.pages p
  where p.vanity_name = published_page.page_selector and p.visibility = 'published'
$$;

-- Shared guard of every guest read (design 3 §3.12): not private, wording published, section enabled if given.
create function public.page_is_live(page_id uuid, section public.section_id default null) returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.pages p
    where p.id = page_is_live.page_id and p.visibility <> 'private' and p.copy_published_at is not null
      and (page_is_live.section is null or exists (
        select 1 from public.page_sections s
        where s.page_id = p.id and s.section = page_is_live.section and s.enabled)))
$$;

create function public.page_summary(page_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'theme', p.theme,
    'default_lang', p.default_lang,
    'sections', coalesce((
      select jsonb_agg(s.section order by s.sort_order) from public.page_sections s
      where s.page_id = p.id and s.enabled), '[]'::jsonb))
  from public.pages p
  where p.id = page_summary.page_id and public.page_is_live(p.id)
$$;

-- What a guest sees of an item and an entry: explicit columns, nothing internal (design 3 §5).
create type public.item_view as (
  id uuid, kind public.item_kind, lang public.lang, title text, body text,
  lang_alt public.lang, title_alt text, body_alt text,
  event_date date, date_precision public.date_precision, recurs_yearly boolean, start_date date,
  zodiac_system public.zodiac_system, zodiac_key text, sort_order numeric);

create type public.entry_view as (
  id uuid, display_name text, body text, lang public.lang, approved_at timestamptz, created_at timestamptz);

-- ponytail: fixed page size of 50; make it an argument when a screen needs another size.
create function public.list_items(page_id uuid, section public.section_id, after_sort numeric, after_id uuid)
returns setof public.item_view
language sql stable set search_path = '' as $$
  select i.id, i.kind, i.lang, i.title, i.body, i.lang_alt, i.title_alt, i.body_alt,
    i.event_date, i.date_precision, i.recurs_yearly, i.start_date, i.zodiac_system, i.zodiac_key, i.sort_order
  from public.items i
  where public.page_is_live(list_items.page_id, list_items.section)
    and i.page_id = list_items.page_id and i.section = list_items.section and i.status = 'published'
    and (list_items.after_id is null or (i.sort_order, i.id) > (list_items.after_sort, list_items.after_id))
  order by i.sort_order, i.id
  limit 50
$$;

create function public.list_entries(page_id uuid, after_created_at timestamptz, after_id uuid)
returns setof public.entry_view
language sql stable set search_path = '' as $$
  select e.id, e.display_name, e.body, e.lang, e.moderated_at, e.created_at
  from public.guestbook_entries e
  where public.page_is_live(list_entries.page_id, 'guestbook')
    and e.page_id = list_entries.page_id and e.status = 'approved'
    and (list_entries.after_id is null or (e.created_at, e.id) < (list_entries.after_created_at, list_entries.after_id))
  order by e.created_at desc, e.id desc
  limit 50
$$;

-- guest_*: the page comes from the token, never from an argument (design 1 §5).

create function public.guest_open(token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.page_summary(public.token_page(guest_open.token))
$$;

create function public.guest_list(token text, section public.section_id, after_sort numeric default null, after_id uuid default null)
returns setof public.item_view
language sql stable security definer set search_path = '' as $$
  select * from public.list_items(public.token_page(guest_list.token), guest_list.section, guest_list.after_sort, guest_list.after_id)
$$;

create function public.guest_guestbook_list(token text, after_created_at timestamptz default null, after_id uuid default null)
returns setof public.entry_view
language sql stable security definer set search_path = '' as $$
  select * from public.list_entries(public.token_page(guest_guestbook_list.token), guest_guestbook_list.after_created_at, guest_guestbook_list.after_id)
$$;

-- public_*: Published pages only, found by vanity name (design 1 §5.1, §10.2).

create function public.public_open(page_selector text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.page_summary(public.published_page(public_open.page_selector))
$$;

create function public.public_list(page_selector text, section public.section_id, after_sort numeric default null, after_id uuid default null)
returns setof public.item_view
language sql stable security definer set search_path = '' as $$
  select * from public.list_items(public.published_page(public_list.page_selector), public_list.section, public_list.after_sort, public_list.after_id)
$$;

create function public.public_guestbook_list(page_selector text, after_created_at timestamptz default null, after_id uuid default null)
returns setof public.entry_view
language sql stable security definer set search_path = '' as $$
  select * from public.list_entries(public.published_page(public_guestbook_list.page_selector), public_guestbook_list.after_created_at, public_guestbook_list.after_id)
$$;

-- Functions are executable by PUBLIC by default; revoke everywhere, then grant the read functions to anon.
revoke all on function
  public.seed_page_sections(), public.token_page(text), public.published_page(text),
  public.page_is_live(uuid, public.section_id), public.page_summary(uuid),
  public.list_items(uuid, public.section_id, numeric, uuid), public.list_entries(uuid, timestamptz, uuid),
  public.guest_open(text), public.guest_list(text, public.section_id, numeric, uuid),
  public.guest_guestbook_list(text, timestamptz, uuid),
  public.public_open(text), public.public_list(text, public.section_id, numeric, uuid),
  public.public_guestbook_list(text, timestamptz, uuid)
from public;

grant execute on function
  public.guest_open(text), public.guest_list(text, public.section_id, numeric, uuid),
  public.guest_guestbook_list(text, timestamptz, uuid),
  public.public_open(text), public.public_list(text, public.section_id, numeric, uuid),
  public.public_guestbook_list(text, timestamptz, uuid)
to anon;
