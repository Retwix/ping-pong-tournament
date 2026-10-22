-- ============================================================
-- Ping-Pong — Match démarré vs. chrono lancé
-- Run in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run (idempotent).
-- ============================================================

-- `started_at` now means « the referee put this match on the table »: it is
-- stamped when the match opens in referee mode, so the dashboard, the TV view
-- and the board all show it live before a single point is played.
-- The chrono is `first_point_at`, stamped on the first point — a match waiting
-- on the table shows 0:00 until someone scores.
alter table public.matches add column if not exists first_point_at timestamptz;

-- Rows written before this column existed stamped `started_at` on the first
-- point, so that timestamp *is* their chrono. Only matches that actually have
-- points are backfilled — the app falls back to the same rule if this is skipped.
update public.matches
  set first_point_at = started_at
  where first_point_at is null
    and started_at is not null
    and (score_a > 0 or score_b > 0);
