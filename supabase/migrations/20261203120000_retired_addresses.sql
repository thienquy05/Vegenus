-- Retired page addresses (owner decision 2026-11-27, PRD §12). When a page is deleted, page_vanity_names loses its rows
-- by cascade; each name leaves a SHA-256 fingerprint here so it stays reserved forever: an old link, a saved or printed
-- address or a search result can never open someone else's page. The readable name goes with the page (the address was
-- public while Published, so a plain digest is proportionate; no server secret is reachable from a cascade). It can
-- confirm a guessed address but lists none.
create table public.retired_vanity_names (
  name_hash bytea primary key check (octet_length(name_hash) = 32),
  retired_at timestamptz not null default now()
);
alter table public.retired_vanity_names enable row level security;
revoke all on public.retired_vanity_names from public, anon, authenticated;

create function public.retire_vanity_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.retired_vanity_names (name_hash) values (extensions.digest(old.name, 'sha256')) on conflict do nothing;
  return null;
end
$$;
revoke all on function public.retire_vanity_name() from public, anon, authenticated;
create trigger retire_vanity_name after delete on public.page_vanity_names
  for each row execute function public.retire_vanity_name();

-- The reservation check also refuses a retired name (the same 23505, so O9 says "already taken").
create or replace function public.reserve_vanity_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.page_vanity_names n where n.name = new.vanity_name and n.page_id <> new.id)
    or exists (select 1 from public.retired_vanity_names r where r.name_hash = extensions.digest(new.vanity_name, 'sha256')) then
    raise exception 'the page address is taken' using errcode = '23505';
  end if;
  insert into public.page_vanity_names (name, page_id) values (new.vanity_name, new.id) on conflict (name) do nothing;
  return null;
end
$$;
