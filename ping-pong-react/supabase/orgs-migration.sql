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

-- The client reads the company from the token, never from these tables.
alter table public.orgs        enable row level security;
alter table public.memberships enable row level security;
