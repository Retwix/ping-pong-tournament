-- ============================================================
-- Match-ball tracking — Supabase migration
-- Run in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to run more than once.
-- ============================================================

-- Per-match count of match balls (match points) SAVED by each side: a point
-- won while the opponent was one point away from winning the match.
-- A match ball saved by one side is a match ball WASTED by the other, so the
-- "wasted" stat is derived from the opponent's saved count (no separate column).
alter table public.matches add column if not exists mb_saved_a int not null default 0;
alter table public.matches add column if not exists mb_saved_b int not null default 0;
