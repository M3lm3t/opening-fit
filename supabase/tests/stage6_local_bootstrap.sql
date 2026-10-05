\set ON_ERROR_STOP on
-- Test-only Supabase platform primitives; run in a fresh loopback database.
do $$ begin
  if not exists(select from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_user::text $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key, bucket_id text, name text);
create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1, '/') $$;
\ir ../migrations/202605230001_user_data_persistence.sql
\ir ../migrations/202605240001_user_owned_table_rls.sql
\ir ../migrations/202605250001_openingfit_retention_backend.sql
\ir ../migrations/202605270001_premium_entitlements_and_dedupe.sql
\ir ../migrations/202605310003_recommendation_history.sql
\ir ../migrations/202606010001_cloud_persistence_hardening.sql
\ir ../migrations/202606170001_openingfit_retention_snapshots.sql
\ir ../migrations/202607170003_versioned_report_snapshots.sql
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
insert into auth.users(id,email) values
 ('11111111-1111-4111-8111-111111111111','one@example.test'),
 ('22222222-2222-4222-8222-222222222222','two@example.test');
insert into public.report_history(user_id, report, summary) values
 ('11111111-1111-4111-8111-111111111111', '{"repertoireHealth":{"version":"repertoire_health_v3","score":61}}','{}'),
 ('22222222-2222-4222-8222-222222222222', '{"repertoireHealth":{"version":"repertoire_health_v3","score":72}}','{}');
\ir ../migrations/202610040001_stage6_report_isolation.sql
