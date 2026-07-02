-- ============================================================
-- Ping-Pong — Chaos Mode
-- Run in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run (idempotent). See docs/chaos-mode.md.
-- ============================================================

-- Per-tournament chaos configuration. Off by default, so existing tournaments
-- and any created before this migration behave exactly as before.
alter table public.tournaments add column if not exists chaos_enabled   boolean not null default false;
alter table public.tournaments add column if not exists chaos_interval  int     not null default 2;      -- roll every X combined points (1 = Mayhem)
alter table public.tournaments add column if not exists chaos_intensity text    not null default 'full'; -- 'mild' | 'full'
alter table public.tournaments add column if not exists chaos_legendary boolean not null default true;   -- allow rare legendary modifiers
