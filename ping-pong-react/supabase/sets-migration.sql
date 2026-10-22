-- ============================================================
-- Ping-Pong — Parties en sets (Bo3 / Bo5)
-- Run in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run (idempotent).
-- ============================================================

-- Sets in a quick game's match: 1 for a single game, an odd N for a best-of-N.
-- Defaults to 1, so existing tournaments and any created before this migration
-- stay single games.
alter table public.tournaments add column if not exists best_of int not null default 1
  check (best_of >= 1 and best_of % 2 = 1);

-- The validated sets before the one in play, as [[a, b], …]. score_a/score_b
-- keep holding the points of the set in play (the deciding set once done), so
-- single games keep an empty array.
alter table public.matches add column if not exists sets jsonb not null default '[]'::jsonb
  check (jsonb_typeof(sets) = 'array');
