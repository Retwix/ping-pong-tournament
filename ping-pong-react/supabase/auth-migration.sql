-- ============================================================
-- Slack sign-in and player linking — migration for EXISTING databases
-- Run in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- Spec: docs/superpowers/specs/2026-08-27-slack-auth-design.md
--
-- Scope: deleting a player and deleting a tournament require a signed-in
-- account linked to a player row. Everything else stays open — reading, adding
-- players, creating tournaments, scoring matches, editing player details.
-- ============================================================

-- ---------- who a row belongs to ----------
-- auth_user_id answers "may you act". slack_user_id keeps its own meaning: the
-- Slack user id the notification bot @mentions. Both are written at claim time.
alter table public.players
  add column if not exists auth_user_id uuid references auth.users(id);

-- One player per Slack account, while leaving every unclaimed row null.
create unique index if not exists players_auth_user_id_key
  on public.players (auth_user_id) where auth_user_id is not null;

-- ---------- the claim, constrained to one transition ----------
-- RLS cannot restrict WHICH columns an update touches, and the update policy
-- below is open, so any authenticated user could otherwise write auth_user_id
-- on any row — including someone else's uid on someone else's row. The
-- column-level rule therefore lives in a trigger.
--
-- Exactly one transition is permitted: null -> your own auth.uid(). Unclaiming,
-- reassigning and claiming as somebody else all raise. Every other column is
-- left alone.
create or replace function public.guard_player_claim() returns trigger as $$
begin
  if new.auth_user_id is distinct from old.auth_user_id then
    if old.auth_user_id is not null then
      raise exception 'player already claimed';
    end if;
    if new.auth_user_id is distinct from auth.uid() then
      raise exception 'you can only claim a player as yourself';
    end if;
  end if;
  return new;
end $$ language plpgsql security definer set search_path = public, auth, pg_temp;

drop trigger if exists guard_player_claim on public.players;
create trigger guard_player_claim
  before update on public.players
  for each row execute function public.guard_player_claim();

-- ---------- policies, split per command ----------
-- THIS IS THE STEP THAT SILENTLY MAKES THE FEATURE A NO-OP IF IT IS MISSED.
-- "public access players" is `for all using (true)`, which covers delete too,
-- and RLS policies are OR'd together. Adding a restrictive delete policy NEXT
-- TO the blanket one changes nothing whatsoever. The blanket policy has to go.
drop policy if exists "public access players" on public.players;

create policy "read players"   on public.players for select using (true);
create policy "insert players" on public.players for insert with check (true);
create policy "update players" on public.players for update using (true) with check (true);

-- Deleting requires being linked to some player row: deletes become
-- attributable to a person.
--
-- This policy queries players from within a policy on players, which is the
-- usual way to earn `infinite recursion detected in policy for relation
-- "players"`. It is safe only because the subquery is evaluated against the
-- select policy above, and that policy is unconditional — the chain terminates
-- at `using (true)` instead of re-entering this one. IF READS ARE EVER
-- RESTRICTED, THIS POLICY MUST BE REVISITED: the exists clause then belongs in
-- a security definer function that bypasses RLS on the lookup.
create policy "delete players" on public.players for delete
  using (exists (select 1 from public.players p where p.auth_user_id = auth.uid()));

-- Same split, same rule, for tournaments.
drop policy if exists "public access tournaments" on public.tournaments;

create policy "read tournaments"   on public.tournaments for select using (true);
create policy "insert tournaments" on public.tournaments for insert with check (true);
create policy "update tournaments" on public.tournaments for update using (true) with check (true);

create policy "delete tournaments" on public.tournaments for delete
  using (exists (select 1 from public.players p where p.auth_user_id = auth.uid()));

-- public.matches keeps its blanket policy on purpose: nothing in this scope
-- guards matches. Same for predictions and rating_events.
