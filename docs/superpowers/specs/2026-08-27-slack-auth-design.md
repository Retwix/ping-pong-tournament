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

- A sign-in control in the page header. It lives in `DashboardNav`, because this
  app has no shared header — every screen renders its own.
- On first sign-in, a claim modal. **Revised 2026-08-31:** linking is mandatory
  and there is no "later". Signed-in-but-unlinked is the state where the app
  looks broken, since a delete the policies refuse affects zero rows without
  raising. The way out is to sign out again, which is therefore the only other
  control on the modal.
- **An auto-match preselects; it never confirms itself.** Matching is a guess
  about which human this is, and only that human can settle it, so their row
  arrives highlighted and they still press "C'est moi". This collapses the two
  paths above — confirm-a-match and pick-from-a-list — into one screen.
- Someone with no row creates one from the modal and claims it in a single
  press. Making linking mandatory closed the door they would otherwise use:
  adding players is open to everyone, but not from behind a blocking modal.
- The two guarded delete buttons stay visible when signed out and prompt
  sign-in on click. A button that vanishes reads as a bug; a button that
  explains itself does not. `deleteAction` resolves the three states — signed
  out, signed in but unlinked, linked — because being signed in is not the same
  as being allowed.

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

## Deferred, and owed

Not "won't do" — these are decisions to revisit, recorded so they are not lost
when the branch is.

### Adapter tests

Decided 2026-08-28: `useSession.ts` and `claimPlayer` ship without unit tests
for now, following the convention already in place — `db.ts` and all eight
hooks under `src/hooks/` are untested, and nothing in the 34-file suite touches
Supabase or React. The tested logic stays pure: `matchPlayer` and
`linkedPlayer` in `src/lib/slackIdentity.ts` carry the decisions, and the
database rules were verified directly against Postgres.

**These tests are still owed.** The deferral is about sequencing, not about
whether adapter code deserves coverage — it does, and CLAUDE.md's rule against
untested production code is not waived here, only postponed with the debt
written down. Paying it means choosing a home first: either a Supabase mock, or
Vitest Browser Mode with vitest-browser-react, which would cover the sign-in and
claim flows as components and is the more valuable of the two. Neither exists in
this project yet, so either is a piece of work in its own right.

### Deploy ordering

**Do not apply `auth-migration.sql` before the sign-in and claim UI ships.**

A delete refused by RLS does not raise — it affects zero rows and returns no
error. Verified locally. Until sign-in exists, every visitor is unlinked, so
every guarded delete silently does nothing.

The casualty is the add-player flow. `Players.tsx` inserts a real `Nouveau
joueur` row before anything is typed, and Cancel deletes it
(`Players.tsx:124-157`). Between the migration and the UI, Cancel would quietly
fail and strand a row in the roster every single time. "Accepted consequences"
above tolerates orphan rows as an edge case for signed-out visitors; applying
the migration early makes them the normal case for everyone.

The safe order: enable the Slack provider, ship sign-in and claiming, then
migrate.
