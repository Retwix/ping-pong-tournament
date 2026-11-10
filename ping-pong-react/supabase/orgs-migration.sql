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
insert into public.orgs (id, slack_team_id, name)
values ('7ec0c0de-0000-4000-8000-000000000001', 'T_RECOVR_TEAM_ID', 'Recovr')
on conflict (id) do nothing;

-- ---------- the access-token hook ----------
-- GoTrue calls this as supabase_auth_admin on every token issue, sign-in and
-- refresh. The company is the workspace of the Slack identity signed in with
-- most recently.
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
