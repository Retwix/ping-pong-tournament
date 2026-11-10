# Make it worldwide — other companies use the app

Status: split into stories; W1 planned in `plans/2026-11-09-w1-recovr-becomes-a-company.md`

## Goal

Other companies can use the ping-pong app, not only ours.

## Decisions

1. **One shared hosted app** (2026-11-09). Every company lives in the same deploy and Supabase project, separated by organisation. Rejected: each company self-hosting a copy; copies first, shared later.
   Consequence: real multi-tenancy (org on every table, access rules per org), and the operator owns uptime, backups and cost for every company.

2. **Members only** (2026-11-09). Reading, scoring and adding players all require a signed-in member of the company. Rejected: open by link with sign-in only for deletes (today's model); each company choosing.
   Consequences: every RLS policy is keyed on membership, so the anon key reads nothing. The share-link tokens in the draft design aren't needed for people. Today's frictionless "open the URL and play" onboarding goes away for every company, ours included.

3. **Slack workspace = company** (2026-11-09). Signing in with Slack maps the workspace's `team_id` to an org, and the first sign-in from an unknown workspace creates it. Membership is automatic, with no invite screens. Rejected: email domain = company; create-and-invite.
   Consequences: the Slack app gets distributed (public OAuth; no directory listing needed). Companies without Slack can't join. The `team_id` gate (memory: distribution plan) is now part of the core design, not a pre-req patch.

4. **Guests stay: roster rows without accounts, claimed later** (2026-11-09). A signed-in member can add players who haven't signed in and record ranked games against them. The row belongs to the member's org, and the person claims it on first Slack sign-in. Rejected: players exist only through sign-in; guest games unranked.
   Consequences: claiming must be scoped to the claimant's org (an account can only claim an unclaimed row in its own org). `players_auth_user_id_key` and the name-based matching become per-org.

5. **The TV signs in as a member** (2026-11-09). Someone signs in with Slack once in the TV's browser, and the session renews itself. Nothing to build. Rejected: read-only display link; TV kept Recovr-only.
   Accepted risks: the TV holds that member's full rights, and it needs a fresh sign-in if that member leaves the workspace.

6. **French + English at launch** (2026-11-09). Every string moves into an i18n layer and gets an English translation; dates and numbers format with the active locale instead of hardcoded `fr-FR`. Rejected: French only for now; switch to English.
   Consequence: a cross-cutting change through nearly every component and its tests. The Slack edge function's French messages fall under this too, if Slack messages survive.

7. **Language follows the browser, with a FR/EN toggle** (2026-11-09). Browser languages starting with `fr` get French; everything else gets English. A switch beside the theme toggle overrides it and is remembered on the device. No schema change. Rejected: per-company language; browser with no override.

8. **Slack messages are removed; Slack is sign-in only** (2026-11-09). Delete `slack-notify`, its secrets (`SLACK_BOT_TOKEN`, `SLACK_CHANNEL`, `APP_BASE_URL`), `src/lib/slack.ts`, `VITE_SLACK_ENABLED` and the `deploy:slack` script. Rejected: keeping it for Recovr only; per-company bot tokens.
   Why: it posts with a global token for any tournament id, so it would let any company post into Recovr's Slack, and nobody uses it. Open for planning: drop the tournaments columns `slack_channel`, `slack_thread_ts` and `result_notified`, or leave them inert.

9. **Neutral product, company name shown** (2026-11-09). One product name and look for every company. Each company's name, taken from the Slack workspace name at sign-in, appears in the header and on the TV. No per-company colours or logos. Rejected: per-company colour and logo; keeping Recovr branding for everyone.
   Still open: the product name, and whether Recovr's purple stays as the product look.
10. **Departments are per company and editable** (2026-11-09). A new company starts from a short default set, and members can add, rename and remove departments. Needs a per-org departments table replacing `lib/teams.ts`. Rejected: dropping departments; one fixed list for all.

11. **Any member may delete and edit departments, as today** (2026-11-09). No roles; the access rule is "member of this org". Rejected: creator-as-admin with promotion; soft delete. Accepted risk: one member can wipe the company's roster, and the nightly backup is the only undo.

12. **The active company is the workspace you signed in with** (2026-11-09). An account in two workspaces keeps both memberships. The access-token hook takes the org from the most recent sign-in's `team_id`, and switching means signing in again with the other workspace. Rejected: a company switcher; one company per account.
   To verify before planning: whether GoTrue auto-links two Slack identities with the same email into one auth user. If it doesn't, each workspace is a separate account and this case doesn't arise.

13. **Paris time for everyone** (2026-11-09). Seasons, day boundaries and the weekday assumption stay on the Europe/Paris calendar for every company. No org timezone column. Season *names* still go through i18n. Rejected: per-company timezone; per-company season dates.

14. **Free now, designed for paid later** (2026-11-09). No billing code. The `orgs` table carries room for a plan and status (e.g. `plan`, `status`) so billing can be added later without reinterpreting existing rows. Stay on the free tiers until usage forces an upgrade. Rejected: free with no provision; paid subscription at launch.
   Note: Vercel's hobby tier is non-commercial, so taking money later means moving to Vercel Pro (or another host) at the same time.

15. **Privacy page plus manual erase on request** (2026-11-09). A privacy page, linked from the sign-in screen, says what's stored and gives a contact address. The operator erases a company (the org cascading through every table plus its avatars) or a person with a tested SQL function. No self-serve deletion UI. Rejected: self-serve deletion; deferring privacy.

16. **Placeholder product name, Recovr purple kept** (2026-11-09). Working title "Ping-Pong", held in one constant (an i18n key) so it's trivial to swap. `#4A2AA4` and the current theme become the product's look. The unused `recovr-logo-*.svg` and the `rv-theme` storage key are cleanup candidates. Renaming the key resets everyone's saved theme once, so either migrate it or leave it alone.

17. **Recovr crosses over with a claim drive, then the flip** (2026-11-09). The org migration ships invisibly (every row stamped with the Recovr org while access stays open). The team signs in and claims their players while the app is still open, and the access rules switch to members-only once the regulars have claimed. Unclaimed rows stay claimable afterwards. Rejected: hard switch on a date; exempting Recovr from members-only.

## Facts (inventory, 2026-11-09)

What ties the app to one company today. Paths are relative to `ping-pong-react/`.

- **Schema:** five tables (tournaments, matches, players, rating_events, predictions), none with a tenant column. SQL lives in `supabase/*.sql` and is applied by hand in the SQL editor; there's no migrations dir and no DB deploy in CI.
- **Global constraints that break on the second company:** `players.name` unique (`schema.sql:101`); `tournaments_one_active` (`schema.sql:50`), with `db.ts:179` clearing is_active on *every* row; `players_auth_user_id_key` global (`schema.sql:117`); the edge function and backfill link players to matches by name.
- **"The" active tournament:** `/live`, `/ref` and `/tv` follow one global active tournament (`db.ts:271`). The URL carries no org or tournament id.
- **RLS today:** matches, predictions and rating_events are `using(true)`. Players and tournaments are open except delete, which is gated on being linked to *any* player. The delete policy reads players from a players policy (`schema.sql:228`), so it must become a security definer function once reads are restricted. The avatars bucket is public and fully open.
- **Auth:** Slack OIDC only. No team_id is checked anywhere; workspace confinement rests on the Slack app being undistributed. team_id arrives as `custom_claims["https://slack.com/team_id"]`. Players are claimed by first-name suggestion plus confirmation (`ClaimGate`), and new players default to team `tech`.
- **Edge function `slack-notify`:** one project-wide `SLACK_BOT_TOKEN` and channel, Slack ids looked up by player name, French messages, and any tournamentId accepted with the anon JWT. Gated client-side by `VITE_SLACK_ENABLED`; the team doesn't use the invitation.
- **Branding and locale:** "Ping-Pong Recovr" in `App.tsx` and `TvScreen.tsx`, the `rv-theme` key, `#4A2AA4`. All copy is hardcoded French with no i18n, plus `fr-FR` formatting, Europe/Paris build time, and seasons starting 2026-09-01 with French northern-hemisphere slugs. Departments are fixed (`lib/teams.ts`: tech, support, marketing, sales, business, guests). Copy assumes "le bureau" and "l'entreprise".
- **Hosting:** Vercel from main; one Supabase project via `VITE_SUPABASE_URL`/`ANON_KEY`. Supabase free plan, whose only backup is the nightly dump to the backups repo.
- **Vision:** a camera-scoring prototype with no Supabase calls, tied to one table by a hand-made calibration file. Out of scope unless decided otherwise.
- **Draft design** `docs/design/slack-auth-schema.html` (option A): `orgs` (slack_team_id, share_token), `memberships`, `org_id` on all five tables defaulting to `current_org_id()` from a custom access-token hook, the two constraints scoped per org, and a seven-step migration order. Since then, team_id has been confirmed present and auth_user_id/slack_user_id exist. It doesn't cover the claim/bio triggers, the recursive delete policy, avatars, or the edge function.

## Out of scope

- `vision/` camera scoring: it doesn't touch Supabase and stays a single-table prototype.

## To settle during planning (details, not product decisions)

- Verify whether GoTrue auto-links two workspaces' Slack identities with the same email into one auth user (decision 12).
- Drop the tournaments columns `slack_channel`, `slack_thread_ts` and `result_notified`, or leave them inert (decision 8).
- `predictions.bettor_name` is free text. Scope it per org, and decide whether bets should tie to the signed-in member.
- Avatars bucket: per-org paths and policies (today it's public and open).
- The delete policy must become a security definer function once reads are restricted (`schema.sql:228`).
- The `rv-theme` key: migrate or keep (decision 16).
- The Slack app's distribution settings and OAuth redirect URLs for other workspaces.

## Stories (split 2026-11-09)

### Parent

A colleague at any company with Slack signs in and plays on their own company's ladder, which no other company can see, in French or English, while Recovr keeps its history.

### Recommended first slice

**W1: Recovr becomes a company.** A Recovr member who signs in with Slack sees "Ping-Pong · Recovr" in the header, and someone from an unknown workspace is told their workspace isn't on Ping-Pong yet.

Why first: it is the steel thread through the riskiest parts, all invisible to today's play:
- `orgs`/`memberships`
- the custom access-token hook carrying `org_id`
- `team_id` read from the Slack identity
- `org_id` backfilled on all five tables

It also installs the `team_id` gate, so the Slack app can be distributed safely and the path can be tested with a throwaway Slack workspace long before any real company arrives.

### Split candidates

| # | Slice | Value | Includes | Defers | Acceptance examples | Release |
|---|---|---|---|---|---|---|
| W0 | Nobody can post into Recovr's Slack through the app | Closes the hole before a second company exists | Delete `slack-notify`, its secrets, `lib/slack.ts`, `VITE_SLACK_ENABLED`, `deploy:slack` | Dropping the tournaments' slack columns (parking lot) | Starting or finishing a tournament makes no Slack call; the function URL returns 404 | Ship anytime; must precede W5 |
| W1 | Recovr becomes a company | Proves tenancy and the token hook in prod; company name visible | `orgs` (with `slack_team_id`, `name`, room for `plan`/`status`), `memberships`, access-token hook, `org_id` on all five tables backfilled to Recovr, membership written on sign-in, header and TV read "Ping-Pong · <company>", unknown `team_id` refused with a message | Members-only (W3), creating orgs (W5), per-org constraints (W5) | Recovr member signs in → JWT carries Recovr's org and the header shows "Ping-Pong · Recovr"; test-workspace member signs in → sees "your workspace isn't on Ping-Pong yet" and gets no membership; signed-out play still works and new rows land in Recovr | Shippable; access stays open |
| W2 | Recovr players are nudged to claim before the switch | Regulars claim while it's painless; the flip date is driven by data | Banner for signed-out visitors announcing sign-in; a saved query showing the claimed vs. unclaimed regulars | Any forced sign-in | Signed-out visitor sees the banner; after signing in and claiming, it's gone | Shippable; may be just copy plus a SQL query |
| W3 | Only members see and use their company's ladder | Recovr's data stops being public; prerequisite for other companies | Policies switch to membership on all tables plus Realtime; delete check moves to a security definer function; avatars per org; signed-out visitors see only sign-in; the transitional Recovr default for `org_id` is removed | Second company (W5) | Signed-out: sign-in screen, and the anon key reads 0 rows from every table; member: everything works, including the TV after one sign-in; prediction bets still work | Shippable after W2's claim drive |
| W4 | Privacy page and erasure on request | Lawful to host another company's people | Privacy page linked from sign-in (FR, plus EN once W7a exists); tested SQL functions that erase an org (cascading, avatars included) or a person | Self-serve deletion | Erasing a test org leaves 0 rows with its `org_id` and no avatar objects; Recovr is untouched | Must ship before or with W5 |
| W5 | A colleague at another company starts their own ladder | The goal: a second company plays, isolated | Unknown `team_id` creates an org named after the workspace; `players.name`, `auth_user_id` and the one-active-tournament rule scoped per org; `db.ts` active-tournament clearing scoped; claim limited to your own org; new orgs get the current fixed departments | Editable departments (W6), English (W7) | Test-workspace member signs in → empty "Ping-Pong · <their workspace>"; both companies can have a player named "Alex" and an active tournament at once; neither sees the other's `/live` or `/tv`; a person in both workspaces sees whichever they signed in with | Shippable; the Slack app is distributed here (or already in W1) |
| W6 | Each company edits its departments | Departments fit the company | Per-org departments table replacing `lib/teams.ts`; new orgs seeded with a short default; members add, rename and remove; Recovr's six migrated | — | Renaming "Sales" changes it on every player; removing a department in use is handled (decided in planning) | Shippable |
| W7a | An English speaker plays a ranked game in English | Non-French companies can use the core loop | i18n layer; browser detection plus FR/EN toggle beside the theme toggle; sign-in, ladder, Nouvelle partie, scoring and result in both languages; locale-aware dates and numbers on those screens | Remaining screens (W7b) | Browser `en-US` → English core loop; toggle to FR persists across reloads; `fr-BE` → French | Shippable; uncovered screens stay French |
| W7b | Every screen in English | Completes the language decision | Tournaments, stats, Me view, TV, predictions, seasons' names, manifest, `lang` attribute | — | No French string is reachable in EN mode (a test over the catalog plus a sweep) | Shippable; may split further per screen during planning |

### Parking lot

- Drop the tournaments' `slack_channel`, `slack_thread_ts` and `result_notified` columns, or leave them inert (after W0).
- Tie prediction bets to the signed-in member instead of the free-text `bettor_name` (after W3).
- Verify GoTrue's identity linking for one email across two workspaces (needed for W5's two-workspace example).
- The `rv-theme` key and the unused `recovr-logo-*.svg` (cleanup; fits W1 or W7b).
- Billing: only room for it in `orgs` (W1); nothing else.

### Warnings

- **W1's transitional `org_id` default.** While access is still open, signed-out inserts carry no org claim, so the column default must fall back to Recovr's org until W3 removes the fallback. Forgetting either half breaks signed-out play or leaves a back door.
- **W3 and W5 depend on the order.** W5 must not ship before W3: until members-only is on, a second company's data would be readable with the anon key.
- **The SQL is applied by hand** (no migrations in CI). W1, W3 and W5 each carry a production migration; prove them on local Postgres first (memory: verify Supabase SQL locally) and take a snapshot before each.
- **W7a and W7b are cross-cutting** and touch the same components as the other slices. Land them after W5, or rebase carefully.
