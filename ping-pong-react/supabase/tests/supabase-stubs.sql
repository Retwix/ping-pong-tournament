-- The parts of a Supabase project that schema.sql and the migrations rely on,
-- for a plain Postgres. Cluster-wide roles are created by scripts/test-sql.sh.
create schema auth;

create table auth.users (id uuid primary key);

create table auth.identities (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  provider        text not null,
  provider_id     text not null,
  identity_data   jsonb not null default '{}'::jsonb,
  last_sign_in_at timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    auth.jwt() ->> 'sub'
  )::uuid $$;

grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public
  grant all on tables to anon, authenticated;

create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id));
alter table storage.objects enable row level security;

create publication supabase_realtime;
