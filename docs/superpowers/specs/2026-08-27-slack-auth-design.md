# Slack sign-in and player linking

**Date:** 2026-08-27
**Status:** approved, not yet implemented

## Problem

The app has no authentication. `supabase.auth` appears nowhere in `src/`, and
every RLS policy is open:

```sql
create policy "public access players" on public.players
  for all using (true) with check (true);
```

The anon key ships inside the client bundle, so anyone who can reach the
deployed URL can open devtools and call `supabase.from('players').delete()`
directly. Any guard expressed only in React is cosmetic. Real guarding means
changing an RLS policy.

We want people to sign in with Slack, link that identity to their player row,
and use the link to protect the actions that are hardest to undo.

## Scope

Deleting a player and deleting a tournament require a signed-in account that is
linked to a player row.

Everything else is untouched: reading, adding players, creating tournaments,
scoring matches, editing player details. In particular **adding a player stays
open** — see "Accepted consequences".

## Decisions

| Question | Decision |
| --- | --- |
| What gets guarded first | Destructive actions only — the two deletes |
| What makes someone trusted | Being linked to a player row, so deletes are attributable to a person |
| How the link is established | Auto-match on name, with a picker as fallback |
| Who enforces the claim | The client writes it; RLS plus a trigger constrain it |
| The add-then-cancel orphan | Accepted, to keep adding players frictionless |

## Data model

One migration, `supabase/auth-migration.sql`.

### New column

```sql
alter table public.players
  add column if not exists auth_user_id uuid references auth.users(id);

create unique index if not exists players_auth_user_id_key
  on public.players (auth_user_id) where auth_user_id is not null;
```

`auth_user_id` answers "may you act". The `slack_user_id` column keeps its own
meaning — the Slack user id the notification bot uses for `@mentions` — and is
written alongside `auth_user_id` at claim time.

**Enabling real mentions is not a free side effect of this work.** The
column is declared in `schema.sql:103` and in `slack-migration.sql`, but that
migration was never applied to production: `db.ts:26` and `db.ts:45` both strip
`slack_user_id` out of every write, each with a comment saying the column does
not exist yet. Meanwhile `supabase/functions/slack-notify/index.ts:113` reads
it. The bot reads a column nothing writes. Making mentions work therefore takes
three things, not one — apply the migration, delete both strips in `db.ts`, and
write the value at claim time — and only the third is auth work.

The partial unique index enforces one player per Slack account, while leaving
every unclaimed row `null`.

### Claim trigger

RLS cannot restrict *which columns* an update touches, and the blanket-open
update policy permits any authenticated user to write any column on any row. So
the column-level rule lives in a trigger:

```sql
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
end $$ language plpgsql security definer;

create trigger guard_player_claim
  before update on public.players
  for each row execute function public.guard_player_claim();
```

This permits exactly one transition — `null` → your own `auth.uid()` — and
leaves every other column update alone. Unclaiming, reassigning, and claiming
as someone else all raise.

### Policy split

**This is the step that silently makes the whole feature a no-op if it is
missed.** `"public access players" for all using (true)` covers `delete` as
well, and RLS policies are OR'd together — so adding a restrictive delete
policy alongside it changes nothing at all.

The blanket policy must be dropped and replaced with per-command policies:

```sql
drop policy if exists "public access players" on public.players;

create policy "read players"   on public.players for select using (true);
create policy "insert players" on public.players for insert with check (true);
create policy "update players" on public.players for update using (true) with check (true);

create policy "delete players" on public.players for delete
  using (exists (select 1 from public.players p where p.auth_user_id = auth.uid()));
```

The same split applies to `public.tournaments`, whose delete policy uses the
identical `exists` clause against `players`. `public.matches` keeps its blanket
policy — nothing in this scope guards matches.

The delete policy on `players` queries `players`, which is normally how you earn
`infinite recursion detected in policy for relation "players"`. It is safe here
only because the subquery is evaluated against the `select` policy, and that
policy is unconditional: the chain terminates at `using (true)` instead of
re-entering the delete policy. **If reads are ever restricted, this policy has
to be revisited** — at that point the `exists` clause belongs in a
`security definer` function that bypasses RLS on the lookup.

### Bootstrapping

There is no chicken-and-egg problem. Claiming requires only *being
authenticated* — enforced by the trigger via `auth.uid()` — not being already
linked. The first person to sign in claims their row and can immediately
delete.

## Modules

### `src/lib/slackIdentity.ts` (new, pure)

No Supabase import, so it is directly unit-testable.

```
matchPlayer(slackProfile, players)
  → { kind: 'matched', player }      exactly one unclaimed player whose
                                      normalised name equals a normalised
                                      name from the Slack profile
  → { kind: 'choose', candidates }   zero matches, or more than one
```

Normalisation: lowercase, strip diacritics, trim, collapse internal whitespace.
Applied to both Slack's display name and real name, and to `player.name`.

Two rules keep a wrong confident match — the failure mode that matters most,
being worse than no match at all — out of reach:

- Only rows with `auth_user_id is null` are ever candidates, so nobody can
  auto-match onto a row someone else has taken.
- Anything other than exactly one hit degrades to the picker. The function
  never guesses between two candidates.

`candidates` for the picker is the full list of unclaimed players, so someone
whose Slack name doesn't resemble their roster name can still find themselves.

### `src/hooks/useSession.ts` (new)

Wraps `supabase.auth`: `signInWithOAuth`, `onAuthStateChange`, `signOut`.
Resolves to `{ session, linkedPlayer }`, where `linkedPlayer` is the row whose
`auth_user_id` equals the session user's id, or `null` when unclaimed. Supabase
persists the session in localStorage, so this survives refreshes with no extra
work.

### `src/lib/db.ts` (extended)

One function, `claimPlayer(playerId)`, writing `auth_user_id` and
`slack_user_id` in a single plain `.update()`. The trigger is what makes this
safe; `db.ts` stays idiomatic with the rest of the file.

## UI

- A sign-in control in the page header.
- On first sign-in with no link, a claim modal: either the auto-matched name to
  confirm, or the picker.
- The two guarded delete buttons stay visible when signed out and prompt
  sign-in on click. A button that vanishes reads as a bug; a button that
  explains itself does not.

## Accepted consequences

**Orphan rows.** `Players.tsx` uses an optimistic create: clicking "Ajouter un
joueur" inserts a real `Nouveau joueur` row before anything is typed, so photo
uploads have a player id to attach to, and Cancel deletes that row
(`Players.tsx:124-157`). Guarding deletes while leaving inserts open splits that
pair: a signed-out person can create the row but not cancel it away, leaving a
stray `Nouveau joueur` in the roster.

This is accepted deliberately. Requiring sign-in to add a player would prevent
it at no build cost, but adding players is how new people get onto the ladder
and that should stay frictionless. Any signed-in person can delete the strays,
so it is self-cleaning in practice.

**Reworking the add flow to avoid the orphan was rejected** as non-auth work on
the critical path: the photo upload depends on the row existing, so removing the
optimistic create means reworking image handling in `Players.tsx` first.

## To verify before building

Cheap to check, and each one can invalidate part of the design:

- The exact Supabase provider id for Slack, and whether the older `slack`
  provider or the OIDC one is current.
- What the identity payload actually contains — specifically the Slack user id
  (for `slack_user_id`) and the display and real names (for matching). The
  matching module's input shape depends on this.
- Whether provider configuration alone confines sign-in to our workspace, or
  whether a workspace/team id check is also needed. A non-distributed Slack app
  should restrict the grant to workspace members; that assumption should be
  tested, not trusted.

## Out of scope

- Guarding writes other than the two deletes.
- Per-player rules such as "only you may edit your own profile".
- An admin role or any privilege tier above "linked player".
- Making the app private to reads.
- Turning on real Slack `@mentions` in the notification bot, though this work
  populates the column that would enable it.
- **Multi-workspace tenancy.** Decided 2026-08-27: the first deploy stays
  single-workspace. `ping-pong-react/docs/design/slack-auth-schema.html`
  (`4bdfd8d`) drafts the org-scoped alternative — `orgs`/`memberships`,
  `org_id` on five tables, a `current_org_id()` JWT predicate — and nothing
  here contradicts it; this spec is a strict narrowing. Two constraints in the
  current schema are silently global and would break on a second workspace's
  first action: `players.name` unique (`schema.sql:101`) and
  `tournaments_one_active` (`schema.sql:50`). Neither can be scoped before
  `org_id` exists, so both stay as they are.
