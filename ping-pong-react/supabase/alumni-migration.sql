-- ============================================================
-- Ping-Pong — Les Anciens (archiving players who left the company)
-- Run in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run (idempotent).
-- ============================================================

-- « Les anciens » : a player who has left the company. Their history stays
-- whole and keeps counting for everyone else's rating; they simply stop
-- occupying a spot in the live ladder and the player picker.
alter table public.players add column if not exists status  text not null default 'active';  -- 'active' | 'alumni'
alter table public.players add column if not exists left_at date;  -- departure date; drives « parti en juin 2026 »
