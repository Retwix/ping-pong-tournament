-- ============================================================
-- Ping-Pong — player bio
-- Run in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run (idempotent).
-- ============================================================

-- A one-line title shown under the player's name on their card and in live
-- mode. null = no bio.
alter table public.players add column if not exists bio text
  check (char_length(bio) <= 20);

-- The update and insert policies on players are open to everyone, including
-- signed-out visitors, and RLS cannot restrict which columns a write touches.
-- So "only the account linked to this row writes its bio" lives in a trigger,
-- like guard_player_claim.
--
-- auth.uid() is null for a signed-out visitor and auth_user_id is null on an
-- unclaimed row: `is distinct from` alone would call those equal and wave the
-- visitor through, hence the explicit null check.
--
-- The insert branch closes the other door: without it anyone could create a
-- new, unclaimed player that already carries a bio.
--
-- Not security definer: it needs no privileges, only auth.uid().
create or replace function public.guard_player_bio() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.bio is not null then
      raise exception 'a new player has no bio yet';
    end if;
    return new;
  end if;
  if new.bio is distinct from old.bio
     and (auth.uid() is null or old.auth_user_id is distinct from auth.uid()) then
    raise exception 'you can only change your own bio';
  end if;
  return new;
end $$ language plpgsql set search_path = public, auth, pg_temp;

drop trigger if exists guard_player_bio on public.players;
create trigger guard_player_bio
  before insert or update on public.players
  for each row execute function public.guard_player_bio();
