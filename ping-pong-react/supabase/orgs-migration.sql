-- ============================================================
-- Ping-Pong — companies (W1: Recovr becomes a company)
-- Run in the Supabase dashboard: SQL Editor -> New query -> paste -> Run,
-- then enable the hook in Auth -> Hooks -> Customize Access Token.
-- Safe to re-run (idempotent). Plan: plans/2026-11-09-w1-recovr-becomes-a-company.md
-- ============================================================

-- A company is a Slack workspace. plan and status hold no behaviour yet; they
-- leave room for billing.
create table if not exists public.orgs (
  id            uuid primary key default gen_random_uuid(),
  slack_team_id text not null unique,
  name          text not null,
  plan          text,
  status        text not null default 'active',
  created_at    timestamptz not null default now()
);

create table if not exists public.memberships (
  user_id    uuid not null references auth.users(id) on delete cascade,
  org_id     uuid not null references public.orgs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

-- Recovr keeps a fixed id so the backfill and the signed-out fallback can name
-- it. Its slack_team_id is read from production before this runs there.
-- TRANSITIONAL: W3 makes every write signed in and deletes recovr_org_id().
create or replace function public.recovr_org_id() returns uuid
  language sql immutable as $$ select '7ec0c0de-0000-4000-8000-000000000001'::uuid $$;

insert into public.orgs (id, slack_team_id, name)
values (public.recovr_org_id(), 'T8AH00RHN', 'Recovr')
on conflict (id) do nothing;

-- The org named in the caller's token; null when signed out.
create or replace function public.current_org_id() returns uuid
  language sql stable as $$ select (auth.jwt() ->> 'org_id')::uuid $$;

-- ---------- every row belongs to an org ----------
-- Adding the column with its default fills existing rows: the SQL editor has
-- no token, so they all land in Recovr.
do $$
declare t text;
begin
  foreach t in array array['players', 'tournaments', 'matches', 'rating_events', 'predictions'] loop
    execute format('alter table public.%I add column if not exists org_id uuid
      references public.orgs(id)
      default coalesce(public.current_org_id(), public.recovr_org_id())', t);
    execute format('alter table public.%I alter column org_id set not null', t);
    execute format('create index if not exists %I on public.%I (org_id)', t || '_org_id_idx', t);
  end loop;
end $$;

-- ---------- the access-token hook ----------
-- GoTrue calls this as supabase_auth_admin on every token issue, sign-in and
-- refresh. The company is the workspace of the Slack identity signed in with
-- most recently; a workspace with no org gets no token and no membership.
create or replace function public.custom_access_token_hook(event jsonb) returns jsonb as $$
declare
  org public.orgs;
begin
  select o.* into org
    from public.orgs o
   where o.slack_team_id = (
     select i.identity_data->'custom_claims'->>'https://slack.com/team_id'
       from auth.identities i
      where i.user_id = (event->>'user_id')::uuid and i.provider = 'slack_oidc'
      order by i.last_sign_in_at desc nulls last
      limit 1);

  if org.id is null then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'workspace_not_on_ping_pong'));
  end if;

  insert into public.memberships (user_id, org_id)
  values ((event->>'user_id')::uuid, org.id)
  on conflict do nothing;

  return jsonb_set(event, '{claims}', (event->'claims')
    || jsonb_build_object('org_id', org.id, 'org_name', org.name));
end $$ language plpgsql set search_path = '';

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- Only the hook's role touches these tables; the client reads the company from
-- the token.
alter table public.orgs        enable row level security;
alter table public.memberships enable row level security;

grant select on public.orgs to supabase_auth_admin;
grant insert on public.memberships to supabase_auth_admin;

drop policy if exists "auth admin reads orgs" on public.orgs;
create policy "auth admin reads orgs" on public.orgs
  for select to supabase_auth_admin using (true);

drop policy if exists "auth admin writes memberships" on public.memberships;
create policy "auth admin writes memberships" on public.memberships
  for insert to supabase_auth_admin with check (true);
