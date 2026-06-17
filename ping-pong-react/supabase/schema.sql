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
  kind        text not null default 'tournament', -- 'tournament' | 'game'
  champion    text,
  -- Slack integration: the invitation message anchors a thread that results reply into.
  slack_channel    text,    -- conversation id the invitation was posted to (group DM or channel)
  slack_thread_ts  text,    -- ts of the invitation message (parent of the results reply)
  result_notified  boolean not null default false  -- guard so the result is posted only once
);

-- Add `kind` to databases created before this column existed.
alter table public.tournaments add column if not exists kind text not null default 'tournament';

-- Slack columns for databases created before this integration existed.
alter table public.tournaments add column if not exists slack_channel   text;
alter table public.tournaments add column if not exists slack_thread_ts text;
alter table public.tournaments add column if not exists result_notified boolean not null default false;

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

-- Registry of people who play. Tournaments are built by picking from this list,
-- which makes per-player and per-team stats possible later.
-- team is one of: 'tech' | 'support' | 'marketing' | 'sales' | 'guests'
create table if not exists public.players (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null unique,
  team        text not null default 'guests',
  slack_user_id text   -- Slack user id (e.g. U0123ABCD) for private invitations; null = not on Slack
);

-- Add `slack_user_id` to databases created before this column existed.
alter table public.players add column if not exists slack_user_id text;

-- ---------- player identity on matches ----------
-- Matches reference players by id so stats survive renames / duplicate names.
-- The player_a / player_b text columns are kept as a display snapshot (name at
-- the time of the match). `on delete set null` keeps match history if a player
-- is removed from the registry.
alter table public.matches add column if not exists player_a_id uuid references public.players(id) on delete set null;
alter table public.matches add column if not exists player_b_id uuid references public.players(id) on delete set null;

-- Backfill ids for existing matches by matching the recorded name.
update public.matches m set player_a_id = p.id
  from public.players p where m.player_a_id is null and p.name = m.player_a;
update public.matches m set player_b_id = p.id
  from public.players p where m.player_b_id is null and p.name = m.player_b;

-- ---------- realtime ----------
-- Lets clients subscribe to live INSERT/UPDATE/DELETE on these tables.
-- Guarded so re-running this file does not error if already added.
do $$
declare t text;
begin
  foreach t in array array['tournaments', 'matches', 'players'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------- row level security ----------
-- Open policies: anyone with the anon key can read/write. Fine for a casual,
-- unauthenticated office tool. Tighten later (e.g. add auth + per-user policies)
-- if the app ever needs to be private.
alter table public.tournaments enable row level security;
alter table public.matches     enable row level security;
alter table public.players     enable row level security;

drop policy if exists "public access tournaments" on public.tournaments;
create policy "public access tournaments" on public.tournaments
  for all using (true) with check (true);

drop policy if exists "public access matches" on public.matches;
create policy "public access matches" on public.matches
  for all using (true) with check (true);

drop policy if exists "public access players" on public.players;
create policy "public access players" on public.players
  for all using (true) with check (true);
