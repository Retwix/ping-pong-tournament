-- ============================================================
-- Ping-Pong — Glicko-2 rating system
-- Run in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run (idempotent). See docs/elo-rating-system.md.
-- ============================================================

-- ---------- current rating state on each player ----------
-- Ratings are recomputed deterministically by replaying match history, then
-- persisted here so they can be read cheaply and used outside the app (Slack).
alter table public.players add column if not exists rating        real        not null default 1500;
alter table public.players add column if not exists rd            real        not null default 350;   -- rating deviation (confidence)
alter table public.players add column if not exists vol           real        not null default 0.06;  -- volatility
alter table public.players add column if not exists rated_games   int         not null default 0;
alter table public.players add column if not exists peak_rating   real        not null default 1500;
alter table public.players add column if not exists last_rated_at timestamptz;

-- ---------- per-match rating history ----------
-- One row per player per rated match: their before/after, the weight applied
-- (margin x stakes) and the stakes class. Drives sparklines, trend arrows and
-- "biggest swing / biggest final swing" highlights.
create table if not exists public.rating_events (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid not null references public.matches(id) on delete cascade,
  player_id     uuid not null references public.players(id) on delete cascade,
  rating_before real not null,
  rating_after  real not null,
  rd_before     real not null,
  rd_after      real not null,
  delta         real not null,
  weight        real not null default 1,
  stakes        text not null default 'normal',  -- 'normal' | 'final' | 'grand_final'
  won           boolean not null,
  played_at     timestamptz,
  created_at    timestamptz not null default now()
);

-- One event per (match, player): lets recompute upsert instead of wiping rows.
create unique index if not exists rating_events_match_player
  on public.rating_events (match_id, player_id);
create index if not exists rating_events_player on public.rating_events (player_id, played_at);

-- ---------- realtime ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rating_events'
  ) then
    execute 'alter publication supabase_realtime add table public.rating_events';
  end if;
end $$;

-- ---------- row level security ----------
-- Open policy to match the rest of this casual, unauthenticated office tool.
alter table public.rating_events enable row level security;
drop policy if exists "public access rating_events" on public.rating_events;
create policy "public access rating_events" on public.rating_events
  for all using (true) with check (true);
