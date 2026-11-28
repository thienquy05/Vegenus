-- Offered languages (T3.3; editable copy §4 "Language availability"; data model §3.12; E54). The open functions
-- return `languages_ready`: the languages whose 27 keys all have published text. The page default is always among them (pages_wording_guard); a
-- language with one key unpublished, or set only in the draft, is not offered. Placeholder data only.
begin;
select plan(6);

insert into public.pages (id, theme, default_lang, visibility, timezone, vanity_name, copy_published_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'a_dreamy', 'en', 'token_only', 'UTC', null, now()),
  ('00000000-0000-0000-0000-0000000000a2', 'b_cosmic', 'vi', 'published', 'UTC', 'page-b', now());
insert into public.guest_tokens (page_id, version, token_hash, active, request_id) values
  ('00000000-0000-0000-0000-0000000000a1', 1, sha256('token-a'::bytea), true, gen_random_uuid());

select is(public.guest_open('token-a') -> 'languages_ready', '["en", "vi"]'::jsonb, 'both languages complete: both offered');
select is(public.public_open('page-b') -> 'languages_ready', '["en", "vi"]'::jsonb, 'public_open offers the same set');

-- One Vietnamese key unpublished on A: Vietnamese drops out, the default stays.
update public.page_copy set published_text = null
  where page_id = '00000000-0000-0000-0000-0000000000a1' and key = 'tour.3.body' and lang = 'vi';
select is(public.guest_open('token-a') -> 'languages_ready', '["en"]'::jsonb, 'one unpublished key: that language is not offered');

-- A draft text does not count until it is published (Q82).
update public.page_copy set draft_text = 'Bản nháp'
  where page_id = '00000000-0000-0000-0000-0000000000a1' and key = 'tour.3.body' and lang = 'vi';
select is(public.guest_open('token-a') -> 'languages_ready', '["en"]'::jsonb, 'draft-only text: still not offered');

-- B defaults to Vietnamese; English incomplete leaves Vietnamese alone.
update public.page_copy set published_text = null
  where page_id = '00000000-0000-0000-0000-0000000000a2' and key = 'home.greeting' and lang = 'en';
select is(public.public_open('page-b') -> 'languages_ready', '["vi"]'::jsonb, 'English incomplete on a Vietnamese page: Vietnamese only');

-- Published again: offered again.
update public.page_copy set published_text = 'Hello'
  where page_id = '00000000-0000-0000-0000-0000000000a2' and key = 'home.greeting' and lang = 'en';
select is(public.public_open('page-b') -> 'languages_ready', '["en", "vi"]'::jsonb, 'republished: offered again');

select * from finish();
rollback;
