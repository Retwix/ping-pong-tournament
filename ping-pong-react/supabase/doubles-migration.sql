-- ============================================================
-- Ping-Pong — Partie en double (2v2)
-- Run in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run (idempotent).
-- ============================================================

-- « Double » : a quick game played 2v2. The single match carries the pair
-- display names (« Léo & Inès ») as its players; the two id-pairs live in
-- `teams` so stats stay rename-proof. Off/null by default, so existing
-- tournaments and any created before this migration behave exactly as before.
alter table public.tournaments add column if not exists doubles boolean not null default false;
alter table public.tournaments add column if not exists teams   jsonb;   -- [[idA1,idA2],[idB1,idB2]] | null
