-- Walking skeleton (T1.1): proves `supabase test db` runs pgTAP (a failing assertion fails the job).
begin;
select plan(2);
select has_extension('pgtap');
select has_schema('public');
select * from finish();
rollback;
