-- ============================================================
-- Ping-Pong Tournament — Supabase schema
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- tables ----------
create table if not exists public.tournaments (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null default 'Tournoi',
  target      int  not null default 11,
  players     text[] not null,
  status      text not null default 'active',   -- 'active' | 'done'
  champion    text
);

create table if not exists public.matches (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round         int  not null,
  idx           int  not null,                  -- global display order
  player_a      text not null,
  player_b      text not null,
  score_a       int  not null default 0,
  score_b       int  not null default 0,
  done          boolean not null default false,
  serve_start   text not null default 'a',      -- 'a' | 'b'
  started_at    timestamptz,
  ended_at      timestamptz
);

create index if not exists matches_tournament_idx on public.matches(tournament_id, idx);

-- ---------- realtime ----------
-- Lets clients subscribe to live INSERT/UPDATE/DELETE on these tables.
alter publication supabase_realtime add table public.tournaments;
alter publication supabase_realtime add table public.matches;

-- ---------- row level security ----------
-- Open policies: anyone with the anon key can read/write. Fine for a casual,
-- unauthenticated office tool. Tighten later (e.g. add auth + per-user policies)
-- if the app ever needs to be private.
alter table public.tournaments enable row level security;
alter table public.matches     enable row level security;

drop policy if exists "public access tournaments" on public.tournaments;
create policy "public access tournaments" on public.tournaments
  for all using (true) with check (true);

drop policy if exists "public access matches" on public.matches;
create policy "public access matches" on public.matches
  for all using (true) with check (true);
