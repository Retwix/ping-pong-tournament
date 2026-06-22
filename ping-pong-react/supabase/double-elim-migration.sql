-- ============================================================
-- Ping-Pong Tournament — Double-elimination migration
-- Adds the columns needed for double-elimination brackets.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to run multiple times.
-- ============================================================

-- Tournament format: 'round_robin' (default, existing behaviour) | 'double_elim'.
alter table public.tournaments
  add column if not exists format text not null default 'round_robin';

-- Per-match bracket metadata. All null/false for round-robin matches.
alter table public.matches add column if not exists bracket   text;   -- 'W' | 'L' | 'GF'
alter table public.matches add column if not exists match_key text;   -- stable key within a tournament, e.g. 'W1-0'
alter table public.matches add column if not exists win_to    text;   -- match_key the winner advances to
alter table public.matches add column if not exists win_slot  text;   -- 'a' | 'b' slot to fill on win_to
alter table public.matches add column if not exists lose_to   text;   -- match_key the loser drops to
alter table public.matches add column if not exists lose_slot text;   -- 'a' | 'b' slot to fill on lose_to
alter table public.matches add column if not exists bye boolean not null default false; -- auto walkover

-- Helps advancement look matches up by their bracket key.
create index if not exists matches_match_key on public.matches(tournament_id, match_key);
