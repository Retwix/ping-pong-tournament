# Plan: W1 — Recovr becomes a company

**Branch**: make-it-worldwide
**Status**: Approved 2026-11-09. Steps 1–4 done 2026-11-10 (commits dbddf04..f7837e0). Step 5 mostly done (3f43c37 decoder, 47b8b20 top bar, c50ac13 TV); left: ConfigError, live TV render. The seed's team_id is the placeholder `T_RECOVR_TEAM_ID` until step 7. Harness applies every migration twice.
**Parent**: `plans/2026-11-09-make-it-worldwide.md` (decisions 1–17, story W1)

## Goal

A Recovr member who signs in with Slack sees "Ping-Pong · Recovr", and someone from an unknown Slack workspace is told their workspace isn't on Ping-Pong yet. Access stays open, so nothing about today's play changes.

## Acceptance Criteria

- [ ] A Recovr member who signs in with Slack gets a session whose token carries Recovr's org, and the header reads "Ping-Pong · Recovr".
- [ ] That sign-in records a membership (account ↔ Recovr) if there wasn't one already.
- [ ] A Slack user from any other workspace who signs in gets no session and no membership, and sees a message saying their workspace isn't on Ping-Pong yet.
- [ ] Every existing row in the five tables belongs to Recovr after the migration, and no row has a missing org.
- [ ] Rows created while signed out still land in Recovr (transitional fallback, removed in W3).
- [ ] Signed out, the header reads "Ping-Pong" with no company name. Nothing else about signed-out play changes.
- [ ] The TV masthead and logos read "Ping-Pong · <company>" when the TV's browser is signed in, otherwise "Ping-Pong".
- [ ] The migration is re-runnable and was proven against local Postgres before it touches production.

Out of W1: members-only access (W3), creating orgs for new workspaces (W5), per-org uniqueness constraints (W5), editable departments (W6), English (W7a/b).

## Design

- **`orgs`**: `id uuid pk`, `slack_team_id text unique not null`, `name text not null`, `plan text`, `status text not null default 'active'`, `created_at`. `plan`/`status` are room for billing (decision 14) with no behaviour. Seeded with one row: Recovr's `team_id` and name.
- **`memberships`**: `user_id → auth.users`, `org_id → orgs`, `created_at`, primary key `(user_id, org_id)`.
- **Custom access-token hook** `public.custom_access_token_hook(event jsonb)`, enabled in the Supabase dashboard (Auth → Hooks):
  1. Take the account's Slack identity with the latest `last_sign_in_at`, and read `identity_data->'custom_claims'->>'https://slack.com/team_id'` from it.
  2. If an org has that `slack_team_id`: upsert the membership, add `org_id` and `org_name` to the claims, and return them.
  3. If no org matches: return `{"error": {"http_code": 403, "message": "workspace_not_on_ping_pong"}}`. No token is issued and no membership is written.
- **`current_org_id()`**: reads `org_id` from `auth.jwt()`.
- **`org_id` on players, tournaments, matches, rating_events and predictions**: `not null references orgs`, backfilled to Recovr, `default coalesce(current_org_id(), recovr_org_id())`. `recovr_org_id()` is the **transitional** fallback for signed-out writes, and W3 deletes it.
- **`orgs` and `memberships` have RLS enabled**. The only policy is for `supabase_auth_admin` (the hook's role); anon and authenticated read nothing. The client never reads these tables in W1, because the company name comes from the token.
- **Client**: a pure function decodes the session's access token into `{ orgId, orgName } | null`. The header and TV render `productName` plus the company name. A pure function reads GoTrue's error redirect (`error_description` in the URL) into a "workspace not on Ping-Pong" refusal, and a banner shows it.
- **The product name** "Ping-Pong" lives in one constant (decision 16; it becomes an i18n key in W7a).

## Decisions (approved 2026-11-09)

1. **Where the company comes from on the client.** The hook puts `org_id` and `org_name` into the token, and the client decodes the token. The alternative, reading `orgs` through `memberships`, needs RLS read policies now and a query on every load.
2. **Who writes the membership.** The hook itself upserts it on every token issue, sign-in or refresh. The alternative, a trigger on `auth.identities`, also fires, but then refusal and membership live in two places.
3. **SQL tests are committed and run in CI.** `supabase/tests/*.sql` plus `scripts/test-sql.sh` build a scratch database with Supabase stubs (the `auth` schema, the roles and `auth.jwt()`), apply `schema.sql` and the migrations, and run assertions that raise on failure. CI gets a `postgres` service job. The alternative is running them locally only, as with `auth-migration.sql`, which keeps no regression net.
4. **Signed-out and TV display.** Signed out shows "Ping-Pong" alone. The TV shows the company name only once its browser is signed in, which becomes mandatory in W3.

## Steps

Every step follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. SQL steps go red in `scripts/test-sql.sh`; client steps in vitest (unit for pure functions, browser mode for the banner and header). Mutation testing covers the TS steps with Stryker. For SQL, the "mutants" are hand-made: break each guard (the drop-the-refusal branch, the drop-the-fallback default) and confirm a test goes red.

### Step 1: A committed SQL harness proves today's claim guard

**Acceptance criteria**: `scripts/test-sql.sh` creates a scratch database, stubs Supabase (the `auth` schema with `users`, `identities`, `uid()` and `jwt()`; roles `anon`, `authenticated` and `supabase_auth_admin`; the `supabase_realtime` publication), applies `schema.sql` and the existing migrations, and runs `supabase/tests/*.sql`. One characterisation test passes: claiming a player as somebody else raises. The script exits non-zero when that assertion is broken, and drops the scratch database afterwards. A CI job runs it against a `postgres` service (decision 3).
**RED**: Write the claim-guard assertion first, and see it fail against a stub that skips `auth-migration.sql`.
**GREEN**: The script plus the stubs, applying the real files.
**MUTATE**: Remove the guard's `auth.uid()` check and confirm the test goes red.
**REFACTOR**: Only if the stubs show duplication.
**Done when**: The script passes locally and in CI, and goes red on the mutated guard.

### Step 2: A Recovr Slack sign-in gets Recovr's org in its token and a membership

**Acceptance criteria**: With `orgs` seeded with Recovr's `team_id`, calling the hook for a user whose latest Slack identity carries that `team_id` returns claims with `org_id` = Recovr and `org_name` = 'Recovr', and leaves exactly one membership row. Calling it twice still leaves one row. A user with two Slack identities gets the org of the one signed in most recently.
**RED**: Hook assertions in `supabase/tests/orgs.test.sql`.
**GREEN**: `orgs-migration.sql` with the tables, seed, hook and grants (`supabase_auth_admin` executes; revoked from anon and authenticated).
**MUTATE**: Drop the upsert's conflict clause; order identities ascending; drop the `org_name` claim. Each must go red.
**Done when**: The tests pass and the migration is re-runnable (applying it twice in the harness).

### Step 3: A sign-in from an unknown workspace is refused, with no membership

**Acceptance criteria**: The hook, for a user whose latest Slack identity carries an unknown `team_id` (or no Slack identity), returns the `workspace_not_on_ping_pong` 403 error, and the memberships table is unchanged.
**RED**: Refusal assertions.
**GREEN**: The not-found branch.
**MUTATE**: Return the claims instead of the error, and write the membership before checking; both must go red.
**Done when**: The tests pass.

### Step 4: Every row belongs to an org, and signed-out writes land in Recovr

**Acceptance criteria**: After the migration, all five tables have `org_id not null`, every pre-existing row has Recovr's org, and:
- an insert as anon lands in Recovr;
- an insert as an authenticated user whose JWT carries org X lands in X;
- running the migration twice changes nothing.

Existing RLS behaviour (the open reads, the delete guard) is unchanged.
**RED**: Backfill, default and re-run assertions, with fixtures that satisfy the real schema (`tournaments.players` is not null).
**GREEN**: Add the column nullable with the default, backfill, set not null, add indexes per table (`org_id`).
**MUTATE**: Remove the Recovr fallback from the default (anon insert goes red); skip one table's backfill (not null fails).
**Done when**: The tests pass, including today's claim test.

### Step 5: The header and TV name the signed-in company

**Acceptance criteria**:
- A session whose token carries `org_name` 'Recovr' shows "Ping-Pong · Recovr" in the top bar.
- No session, or a token without the claim (an old session before refresh), shows "Ping-Pong".
- The TV masthead and both logos follow the same rule.
- `ConfigError` shows "Ping-Pong".
- "Recovr" no longer appears in `src/` outside the CSS comment.

**RED**: A unit test for the token decoder: a token with the claims gives `{orgId, orgName}`; without them, a malformed token or null gives null. Then a browser test for the header with a stubbed session (props-driven; memory: `vi.mock` is broken in browser tests).
**GREEN**: The decoder, the `productName` constant, and the header/TV rendering.
**MUTATE**: Stryker on the decoder and the header component.
**Done when**: The tests pass and the mutation report is reviewed.

### Step 6: A refused sign-in tells the visitor their workspace isn't on Ping-Pong yet

**Acceptance criteria**:
- When the app loads with GoTrue's error redirect carrying `workspace_not_on_ping_pong`, the visitor sees a dismissible banner: "Ton espace Slack n'est pas encore sur Ping-Pong."
- The error parameters are removed from the URL.
- Any other auth error shows nothing new.

**RED**: A unit test that parses the redirect URL into the refusal (query and hash forms, since GoTrue's exact shape is verified live in step 7); then a browser test for the banner.
**GREEN**: The parser, the banner, and URL cleanup with `history.replaceState`.
**MUTATE**: Stryker on the parser and the banner.
**Done when**: The tests pass. The redirect shape is confirmed live in step 7, and if it differs, the parser's test changes first.

### Step 7: Production rollout and live check (operator, no code)

**Acceptance criteria**, done with the human:
1. Read Recovr's `team_id` from production with `select distinct identity_data->'custom_claims'->>'https://slack.com/team_id' from auth.identities`, and put it in the migration's seed.
2. Snapshot (the backups-repo dump) before applying.
3. Apply `orgs-migration.sql` in the SQL editor, then re-check from the catalog that `org_id` is not null everywhere and that no row has a null org.
4. Enable the hook in Auth → Hooks → Customize Access Token.
5. In the Slack app, activate public distribution and confirm the redirect URL.
6. Live checks:
   - Recovr sign-in → header "Ping-Pong · Recovr", and one membership row.
   - Signed out → play still works, and a new row's org is Recovr.
   - A throwaway Slack workspace's sign-in → the refusal banner, and no membership.
   - Record the error redirect's real shape (step 6).
7. The TV signs in once and shows "Ping-Pong · Recovr".

**Done when**: Every live check is recorded in this plan with what was exercised, and the parent plan's W1 is marked done.

## Pre-PR Quality Gate

1. Mutation testing (Stryker for TS, hand-made mutants for SQL as listed per step).
2. Refactoring assessment.
3. `tsc -b`, the unit and browser tests, and `scripts/test-sql.sh` all pass. CI builds the merge (memory), so check after rebasing on main.
4. Glossary: user-facing copy says "company" ("entreprise"), and code and schema say `org`. Check that the project glossary agrees, or add the term with `domain-modeling`.

---
*Delete this file when W1 is complete.*
