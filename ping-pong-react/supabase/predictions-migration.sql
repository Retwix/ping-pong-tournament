-- ============================================================
-- Ping-Pong Tournament — Predictions (pronostics) migration
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run (idempotent).
--
-- The "no-currency streak" betting model: people predict who wins a match (or the
-- whole tournament), no virtual money. Each prediction settles to won/lost when the
-- match/tournament finishes, and the leaderboard ranks bettors by correct calls,
-- accuracy and win streaks. No auth: a bettor is just a chosen name (trust-based).
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists public.predictions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  -- Trust-based identity: whatever name the bettor picked (no account).
  bettor_name   text not null,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  -- null = a tournament-level bet (e.g. champion futures); otherwise a match bet.
  match_id      uuid references public.matches(id) on delete cascade,
  bet_type      text not null default 'winner',  -- 'winner' | 'score' | 'capot' | 'champion'
  -- The prediction itself: a player name ('winner'/'champion'), a score like
  -- '11-7' ('score'), or 'yes'/'no' ('capot').
  target        text not null,
  status        text not null default 'open',     -- 'open' | 'won' | 'lost'
  settled_at    timestamptz
);

-- One pick per bettor, per match, per bet type (re-picking before lock updates it).
create unique index if not exists predictions_one_per_match
  on public.predictions (bettor_name, match_id, bet_type) where match_id is not null;

-- One tournament-level pick per bettor, per type (e.g. one champion guess).
create unique index if not exists predictions_one_per_tournament
  on public.predictions (bettor_name, tournament_id, bet_type) where match_id is null;

create index if not exists predictions_match_idx      on public.predictions(match_id);
create index if not exists predictions_tournament_idx on public.predictions(tournament_id);
create index if not exists predictions_status_idx     on public.predictions(status);

-- ---------- realtime ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'predictions'
  ) then
    execute 'alter publication supabase_realtime add table public.predictions';
  end if;
end $$;

-- ---------- row level security ----------
-- Open policy, consistent with the rest of this casual, unauthenticated app.
alter table public.predictions enable row level security;

drop policy if exists "public access predictions" on public.predictions;
create policy "public access predictions" on public.predictions
  for all using (true) with check (true);
