# Ping-Pong

An office ping-pong ladder, tournaments and live scoring, shared by every company that plays on it.

## Language

**Ping-Pong**:
The product, one name and look for every company.
_Avoid_: Ping-Pong Recovr

**Company**:
A group of colleagues who play on their own ladder, which no other company sees. Shown to players as "entreprise".
_Avoid_: tenant, team, organisation (in copy)
_In code_: `org` (`orgs` table, `org_id` column)

**Workspace**:
The Slack workspace a person signs in with. Each workspace is one company.
_In code_: `slack_team_id`

**Member**:
A person whose Slack account has signed in to a company.
_In code_: a `memberships` row

**Active company**:
The company of the workspace a member signed in with most recently. Switching means signing in again with the other workspace.

## Relationships

- A **workspace** maps to exactly one **company**; a company has one workspace.
- A **member** may belong to several companies but plays in one **active company** at a time.
- Every player, tournament, match, rating event and prediction belongs to one company.

## Flagged ambiguities

- "team" meant both a Slack workspace (Slack's `team_id`) and a player's équipe on the roster (`lib/teams.ts`). Resolved: the Slack side is the **workspace**, never a team.
