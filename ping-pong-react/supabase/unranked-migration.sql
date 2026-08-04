-- ============================================================
-- Ping-Pong — Mode non classé
-- Run in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run (idempotent).
-- ============================================================

-- « Non classée » : the result moves no Elo and is excluded from « Le
-- classement », but stays in the Parties history. Off by default, so existing
-- tournaments and any created before this migration keep counting as before.
alter table public.tournaments add column if not exists unranked boolean not null default false;
