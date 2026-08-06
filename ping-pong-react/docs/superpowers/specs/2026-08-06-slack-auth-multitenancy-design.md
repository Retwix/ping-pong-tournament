# Slack auth + per-workspace tenancy — design

**Date:** 2026-08-06
**Status:** design, approved in conversation — not yet planned
**Visual companion:** [`docs/design/slack-auth-schema.html`](../../design/slack-auth-schema.html)

---

## Problem

The app is open. Every RLS policy reads `using (true)` (`supabase/schema.sql:130-148`) and the
Supabase anon key ships inside the Vite bundle, so anyone who views source can read and write every
table with `curl`. A login screen in React would change nothing about that.

Separately, the app is single-tenant in ways that are invisible today and fatal on the second
company: no table has a tenant column, `players.name` is globally unique, and
`tournaments_one_active` permits exactly one active tournament *worldwide*.

We want: sign in with Slack, and the app recognises whether your company already has a space.

## Goals

1. Nobody outside a signed-in Slack workspace can read or write that workspace's data.
2. Signing in with Slack detects an existing space for your workspace, or offers to create one.
3. `/live` and `/ref` keep working on a TV and a passed-around phone, with no login.
4. Isolation is enforced by Postgres, not by application code.

## Non-goals

- **Slack notifications.** The `slack-notify` Edge Function doesn't currently work and is out of
  scope. `VITE_SLACK_ENABLED` stays false; the function and its columns are left dormant, not
  deleted. Per-workspace bot installation is a separate future workstream.
- **Roles and permissions.** Everyone in an org can do everything, matching today's behaviour.
- **Cross-org anything.** No global leaderboard, no inter-company matches.
- **Enterprise Grid.** We key on `team_id`; `enterprise_id` is a recorded limitation, not a feature.

---

## Decisions

| Question | Decision |
|---|---|
| Scope | Full multi-tenancy — any workspace gets an isolated space |
| Tenancy pattern | Shared schema, `org_id` discriminator, RLS-enforced |
| Player identity | Slack sign-in creates/claims a Player; hand-created guests still allowed |
| `/live` and `/ref` | Public, via an unguessable per-org token |
| Slack bot | Out of scope |

---

## Data model

### New: `orgs`

```sql
create table public.orgs (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  slack_team_id     text not null unique,   -- 'T024BE7LD' — the detection key
  slack_team_name   text not null,          -- as Slack reports it
  slack_team_domain text,                   -- 'recovr' → recovr.slack.com
  name              text not null,          -- editable display name
  slug              text not null unique,   -- 'recovr' — reserved for URLs, see below
  share_token       uuid not null default gen_random_uuid()
);
create unique index orgs_share_token on public.orgs(share_token);
```

`slack_team_id unique` **is** the "does my company already have a space?" feature: one indexed read.

`slug` is included now even though V1 routing doesn't use it. It costs nothing, and adding a
`not null unique` column to a populated table later means a migration with a backfill. Whether URLs
become `recovr.pingpong.app/live` or `pingpong.app/o/recovr/live` is a later, purely-routing call.

`share_token` is deliberately **not** the org id. A URL handed around is a bearer token and will end
up in Slack messages, screenshots and a shared TV's history. Keeping it separate makes revocation
one `update` instead of a foreign-key migration.

### New: `memberships`

```sql
create table public.memberships (
  org_id     uuid not null references public.orgs(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
```

### The tenancy predicate

```sql
create or replace function public.current_org_id() returns uuid
language sql stable as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'org_id', '')::uuid
$$;
```

### `org_id` on the five existing tables

`players`, `tournaments`, `matches`, `rating_events`, `predictions` each gain:

```sql
alter table public.<t> add column org_id uuid
  references public.orgs(id) on delete cascade
  default public.current_org_id();
```

**The column default is the load-bearing decision.** Inserts are stamped by Postgres and reads are
filtered by RLS, so `db.ts`'s ~40 query functions need no `org_id` plumbing. Most of `src/lib/`
(`classement`, `chaos`, `doubles`, `finalStandings`, …) is pure logic that never touches the
database and is entirely unaffected.

`matches.org_id` is denormalised on purpose. It is derivable via `tournament_id`, but deriving it
would force a join on every row **and every Realtime message** on the hottest table.

Tables *without* `org_id` — the shared set, stated explicitly so it isn't implicit: `orgs`,
`memberships`, `auth.users`.

### Indexes

```sql
create index players_org       on public.players(org_id);
create index tournaments_org   on public.tournaments(org_id, created_at desc);
create index matches_org       on public.matches(org_id);
create index rating_events_org on public.rating_events(org_id);
create index predictions_org   on public.predictions(org_id);
```

### Constraints that break

Both are silently global today and fail on the second company's first action.

```sql
-- players.name is unique across the whole database.
alter table public.players drop constraint players_name_key;
create unique index players_org_name on public.players (org_id, name);

-- schema.sql:52 — one active tournament GLOBALLY becomes one per org.
drop index if exists public.tournaments_one_active;
create unique index tournaments_one_active
  on public.tournaments (org_id) where is_active;
```

`rating_events` and `predictions` unique indexes key on `match_id` / `tournament_id` and are already
org-scoped through their foreign keys. No change.

### Player identity

```sql
alter table public.players
  add column auth_user_id  uuid references auth.users(id) on delete set null,
  add column slack_user_id text;   -- schema.sql has it; prod does not (db.ts:26)

create unique index players_org_auth
  on public.players (org_id, auth_user_id)  where auth_user_id  is not null;
create unique index players_org_slack
  on public.players (org_id, slack_user_id) where slack_user_id is not null;
```

`auth_user_id` set = **claimed** (name and avatar from Slack). Null = **guest**, hand-created for
someone who has never signed in. Claiming later is an `update`, so a guest's Elo history survives
the day they finally log in.

This also retires the workaround at `db.ts:26` and `db.ts:44`, where `slack_user_id` is stripped
from every write because the production column never existed.

---

## Auth flow

1. User clicks "Sign in with Slack" → Supabase Auth, Slack OIDC provider.
2. Resolve the user's Slack `team_id` (see *Verification tasks*).
3. `select id from orgs where slack_team_id = $1`.
   - **Match** → upsert `memberships`, upsert/claim their `players` row, in.
   - **No match** → offer "Create <Team>'s space". On confirm: insert `orgs` + `memberships`, then
     **`refreshSession()`**.
4. A Custom Access Token Hook reads `memberships` and stamps `app_metadata.org_id` into the JWT.

The `refreshSession()` is not optional. The user's JWT was minted before the org existed and carries
no `org_id`, so their first write fails RLS with a confusing permission error.

**Users in no org:** `current_org_id()` returns null, every policy denies, and the app shows the
create-a-space screen rather than erroring.

**Users in more than one org:** possible and unhandled in V1. Supabase links identities by email, so
one person in two Slack workspaces is a single `auth.users` row with two memberships. The hook
resolves this deterministically — **most recent membership by `created_at`** — so behaviour is
defined rather than incidental. No org switcher in V1; signing in again from the other workspace
moves you. If this stops being acceptable, the fix is a switcher that re-mints the token, not a
schema change.

---

## Share links for `/live` and `/ref`

Both stay public via `share_token`. For office ping-pong the worst case of a leaked link is someone
fiddling with tonight's score, which is recoverable; a login wall on a Chromecast is not worth it.

**The token must become a JWT, not a request header.** `current_setting('request.headers')` is a
PostgREST mechanism, and Realtime never goes through PostgREST — it authorizes on the WebSocket's
JWT. A header-based token would make `/live` reads succeed while the live subscription silently
returns nothing, which is the entire point of the page.

So: an Edge Function exchanges `share_token` for a short-lived Supabase-signed JWT carrying
`app_metadata.org_id` and `app_metadata.scope = 'share'`. `current_org_id()` then works identically
for members and for the TV, and the link expires on its own.

```sql
create or replace function public.current_scope() returns text
language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'scope', 'member')
$$;
```

A share session may update scores, and only on the org's currently-active tournament:

```sql
create policy "share link scores" on public.matches for update
  using (
    org_id = public.current_org_id()
    and (public.current_scope() <> 'share' or tournament_id in (
      select id from public.tournaments
       where org_id = public.current_org_id() and is_active
    ))
  );
```

---

## RLS

Every tenant table gets the same shape:

```sql
drop policy if exists "public access <t>" on public.<t>;

create policy "members read"  on public.<t> for select
  using (org_id = public.current_org_id());

create policy "members write" on public.<t> for all
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
```

Indexed equality against a JWT claim — no subquery, no join, cheap enough to run per Realtime
message.

`orgs` is readable only by its own members; `memberships` only by the owning user. Neither is
writable from the client — org creation goes through a `security definer` function, so a client
cannot forge a membership into someone else's org.

---

## Migration order

Genuinely ordered. `not null` before the backfill fails outright; dropping old policies before new
ones exist leaves a window where the app is wide open.

1. Create `orgs` and `memberships`. Insert the Recovr row with its real `team_id`. Inert.
2. Add `org_id` as nullable, with the default. Still inert — no policy reads it.
3. Backfill all five tables to the Recovr org. **Snapshot the database first** — this is the only
   step with existing data at stake.
4. Verify zero nulls, then set `not null` and create the indexes.
5. Swap the two global constraints, inside one transaction.
6. Enable Slack OIDC + the token hook. Confirm a real session carries `org_id` **before** touching
   policies.
7. Replace the policies last. This is the moment the app becomes private; everything before it is
   reversible.

---

## Rejected alternatives

**Schema-per-tenant (the Apartment pattern).** Rejected on four counts, the first decisive: there is
no request cycle to hook — Apartment's elevator is Rack middleware owning a connection and setting
`search_path` per request, and this app's browser talks to PostgREST directly. PostgREST exposes an
enumerated schema list rather than switching per request. Realtime would need every new tenant's
tables added to the `supabase_realtime` publication (`schema.sql:117-129`). And migrations become
linear in customers, when the current process is pasting SQL into the Supabase editor by hand.
Supabase's whole model — `auth.uid()`, JWT claims, RLS — assumes the client connects directly and
the database authorizes; schema-per-tenant fights that.

**Database-per-tenant.** Same objections, worse: provisioning, connection management and cost all
scale linearly with customers, for isolation RLS already provides.

**Membership lookup inside RLS** (`exists (select 1 from memberships …)`, no auth hook). Less
plumbing, and org changes take effect without re-login. Rejected because the subquery runs per row
*and per Realtime message*, and a live scoreboard is this app's whole point.

**Edge Function API layer** — all writes through functions that enforce tenancy. Most control, but
it's a rewrite of `db.ts` and it loses the direct-Realtime model `/live` depends on.

**Share token in a request header.** Fails for Realtime; see above.

**App-layer tenancy (`acts_as_tenant`-style default scopes).** Enforced in client code that ships to
the browser, so it isn't enforcement at all.

---

## Risks

**Row-level isolation fails open; schema isolation fails safe.** Add a table and forget its RLS
policy, and it is readable by everyone. This is the real cost of the chosen pattern.

*Mitigation, and an acceptance criterion for the plan:* a test asserting every table in `public` has
RLS enabled and at least one policy. Supabase's linter flags this too, but a failing test blocks a
merge whereas a dashboard warning does not.

**Backfill on live data.** Step 3 is the only hard-to-reverse step. Snapshot first; verify counts
match before step 4.

**Avatars bucket.** Public, with open policies (`supabase/avatar-migration.sql`). Paths are player
UUIDs so they aren't enumerable, but any avatar URL works across orgs. Accepted for V1 as a
conscious decision rather than an oversight; revisit if a customer asks.

**Enterprise Grid.** We key on `team_id`. A Grid org with several workspaces would get several
spaces. Acceptable now; the fix later is keying on `enterprise_id` when present.

---

## Verification tasks

Both must be settled before or during the first implementation slice — neither blocks planning.

1. **Does Supabase persist Slack's `team_id`?** Slack's OIDC userinfo returns
   `https://slack.com/team_id`, but whether Supabase stores that namespaced claim in
   `auth.identities.identity_data` needs confirming, not assuming. Fallback: read `provider_token`
   once after sign-in and call `openid.connect.userInfo` directly, or resolve it inside the auth
   hook.

2. **How to restrict a share session to score columns.** Postgres grants are per-role, not
   per-claim. Either a dedicated `share_scorer` role with column-level `grant update (score_a,
   score_b, done, serve_start, started_at, ended_at, mb_saved_a, mb_saved_b)`, or a trigger.
   Recommendation: the role — it uses Postgres's own machinery rather than a hand-rolled check.
