# Seasons (« Les saisons ») — design

**Date:** 2026-08-12
**Status:** design, approved in conversation — not yet planned
**Design brief:** [`docs/design/seasons-brief.md`](../../design/seasons-brief.md)

---

## Problem

« Le classement » is a single lifetime ladder. Every match ever played counts forever, which
creates two problems that get worse the longer the app runs:

- **Newcomers can't realistically climb.** A player joining today competes against ratings built
  over hundreds of games. The gap is arithmetic, not skill.
- **There is no finish line.** Nothing ever concludes, so nothing is ever won. The app crowns a
  champion per tournament, but the ladder — the thing people actually check — has no moments.

We want recurring competitive periods that reset the ladder, produce a champion, and leave a
browsable archive behind.

## Goals

1. The ladder resets on a predictable cadence so everyone starts each period level.
2. Each period ends with a crowned champion, visible on the home page and on the ladder.
3. Past periods stay browsable — their ladder, their champion, their stats.
4. The lifetime ladder survives, for the people who care who is best overall.

## Non-goals

- **Palmarès / hall-of-fame page.** A dedicated page listing every past champion is a later slice.
  v1 archives are reachable through the ladder's scope selector.
- **Season-scoped match history.** « Les parties » keeps its existing filters; it does not gain a
  season grouping in v1.
- **Per-season rewards, badges, or promotion/relegation tiers.** Out of scope entirely.
- **Configurable cadence.** The cadence is fixed in code. No admin UI, no per-org override.
- **Frozen season results.** Season outcomes are recomputed from match history on every read
  (see [Trade-off: recomputed, not frozen](#trade-off-recomputed-not-frozen)).

---

## Decisions

| Question | Decision |
|---|---|
| What a season *is* | A pure date window — derived, not stored |
| Cadence | Three months, anchored on 1 September (la rentrée) |
| Naming | Named after real seasons: Automne, Hiver, Printemps, Été |
| First season | « Saison Automne 2026 », 1 Sep → 30 Nov 2026 |
| Rating at a boundary | Hard reset — a season replays only its own matches from 1500 |
| Lifetime ladder | Kept, behind a scope selector on « Le classement » |
| Champion | Highest season rating among players with ≥ 10 games |
| Pre-season history | Not retroactive — « Avant les saisons », lifetime ladder only |
| v1 surfaces | Le classement, Les stats, season banner (home + classement) |

### Approach: derived, not stored

Three representations were considered:

- **A — derived date windows.** No table, no column, no migration. A season is a function of a
  timestamp; a season's ladder is a replay of the matches inside its window.
- **B — a `seasons` table with `season_id` stamped on matches.** Queryable in SQL, supports custom
  names and hand-set dates, and a written champion is permanent. Costs a migration, a backfill, and
  a writer that must stamp every match — including matches whose tournament straddles a boundary.
- **C — hybrid: derived windows, plus a row written when a season closes.** Archives become
  immutable reads. Needs something to *trigger* the freeze; the app has no scheduler, so this means
  a Supabase cron/Edge Function, or a lazy freeze racing across open browsers.

**A was chosen.** It matches how the codebase already thinks — `src/lib/rating.ts` opens by stating
that ratings are deterministic, replayable, and rebuildable from history at will. Seasons become one
more filter in front of a replay that already runs on every page load. It also needs no `org_id`,
so it stays compatible with the pending per-workspace tenancy work
(`2026-08-06-slack-auth-multitenancy-design.md`) for free.

C is the natural upgrade path if and when Palmarès lands and frozen archives earn their keep.

### Trade-off: recomputed, not frozen

A closed season's champion is derived, never stored. Deleting or editing a months-old match can
therefore change a past season's result. This is accepted: nobody retro-edits old matches, and the
archive self-correcting is arguably more honest than a stale stored winner. Revisit under approach
C if it ever bites.

---

## The seasons module

One new pure module, `src/lib/seasons.ts`. No schema change.

```ts
/** Seasons begin here. Anything earlier is « Avant les saisons ». */
export const SEASONS_START = new Date(2026, 8, 1)   // 1 Sep 2026, local midnight

export type SeasonSlug = 'automne' | 'hiver' | 'printemps' | 'ete'
export type SeasonId = string                        // 'automne-2026', 'hiver-2026', …

export interface Season {
  id: SeasonId
  slug: SeasonSlug
  label: string        // « Saison Automne 2026 », « Saison Hiver 2026-27 »
  start: Date          // inclusive
  end: Date            // exclusive — the start of the next season
  year: number         // the year the season STARTS in
}

seasonOf(iso: string | null): SeasonId | null   // null ⇒ before SEASONS_START, or undated
seasonById(id: SeasonId): Season | null
currentSeason(now: Date): Season | null         // null until 1 Sep 2026
seasonsUpTo(now: Date): Season[]                // newest first, started seasons only
matchesInSeason(matches: Match[], id: SeasonId): Match[]
daysLeft(s: Season, now: Date): number
isClosed(s: Season, now: Date): boolean
```

### The calendar

| Season | Window | Label |
|---|---|---|
| `automne-<Y>` | 1 Sep → 30 Nov | « Saison Automne \<Y\> » |
| `hiver-<Y>` | 1 Dec → end of Feb | « Saison Hiver \<Y\>-\<Y+1\> » |
| `printemps-<Y+1>` | 1 Mar → 31 May | « Saison Printemps \<Y+1\> » |
| `ete-<Y+1>` | 1 Jun → 31 Aug | « Saison Été \<Y+1\> » |

The id keys off the year the season **starts** in, so winter is `hiver-2026` even though it ends in
2027 — and it is the only label carrying a two-year span, being the only season that crosses New
Year. Month → season is a plain lookup: Sep/Oct/Nov → automne, Dec + Jan/Feb → hiver, Mar/Apr/May →
printemps, Jun/Jul/Aug → été.

Windows end at the exclusive start of the next season (`new Date(y, 2, 1)` for the end of winter),
so February's length never enters the arithmetic and leap years need no special handling.

### Time zone

Boundaries are **local midnight**, computed with `new Date(y, m, 1)` — the same convention
`src/lib/statsPage.ts:startOfWeek` already uses for « Cette semaine ». Everyone plays in Paris, so
local is Paris, and DST never appears in the arithmetic.

Known limitation: a viewer in another time zone sees boundaries shifted by their offset, and on a
boundary day two viewers in different zones can briefly disagree about which season is current.
This is already true of the existing period filters, so it introduces no new inconsistency.

### Season membership

A match belongs to the season containing `ended_at ?? started_at` — the same field
`src/lib/rating.ts:timeKey` already sorts by. Consequences:

- A tournament spanning 30 Nov → 1 Dec **splits** across two seasons, match by match. Each match
  counts where it was played. No special case.
- A match starting 31 Aug 23:50 and ending 1 Sep 00:05 counts to the new season.
- A match with neither timestamp yields `null` and lands in « Avant les saisons ».

---

## Scoping the ladder

The hard reset needs no change to `rating.ts` at all. It is a filter on the replay input:

```ts
const scoped = ratedMatches(matchesInSeason(matches, id), tournaments)
replayRatings(scoped, players, { targetByTournament })
```

**Filter order matters:** season window first, then `ratedMatches`. That keeps « non classée »
tournaments and doubles (always unranked in v1) out of season Elo by the existing rule, with no new
logic.

Everyone's first game of a season finds `lastPlayedAt === null`, so `daysBetween` returns 0 and no
RD decay carries across the boundary. Every player starts at `RATING.R0` (1500) with `RATING.RD0`
(350). The hard reset falls out of the existing engine.

Because scoping happens on the **input matches**, everything downstream — the rating log, trend
arrows, podium, streaks, and every selector in `src/lib/classement.ts` — becomes season-scoped
automatically, with no per-consumer change.

### Hook change

`useRatings` gains a scope argument, defaulting to today's behaviour:

```ts
export type LadderScope = { kind: 'season'; id: SeasonId } | { kind: 'all' }

useRatings(scope: LadderScope = { kind: 'all' })
```

No new query. `useRatings` already loads every finished match and replays on each realtime change;
season scoping filters that same in-memory array, so a season ladder does strictly *less* work than
the lifetime one. No schema, no index, no migration.

### Champion

```ts
seasonChampion(rows: RatingRow[]): RatingRow | null
```

The highest-rated row that is not `provisional`. `rankRatings` already sorts by rating and already
computes `provisional` from `RATING.provisionalGames` (10), so eligibility reuses a threshold the
app defines and displays all season — « provisoire » now also means "not eligible for the crown".

If nobody reached 10 games, there is **no champion**. The banner says so rather than crowning the
top provisional player. Ties are already deterministic: `rankRatings` breaks by RD, then by name.

---

## Surfaces

Detailed states, layout, and copy live in [`docs/design/seasons-brief.md`](../../design/seasons-brief.md).

| Surface | File | Change |
|---|---|---|
| Season banner — home | `src/components/Home.tsx` | New. Current season, days left, leader; champion once closed |
| Season header — ladder | `src/components/Ratings.tsx` | New. Identity of the selected scope |
| Scope selector — ladder | `src/components/Ratings.tsx` | New. Current season · past seasons · « Tous les temps » |
| Period filter — stats | `src/lib/statsPage.ts`, `src/components/Stats.tsx` | One added option, « Cette saison » |
| Eligibility copy | `src/components/Ratings.tsx` | « provisoire » gains "can't win the title" microcopy |

The scope selector **grows over time** — four seasons a year means nine entries by late 2028 — so it
must be a control that scales (a dropdown rather than a segmented control). Design decides the final
form.

« Cette saison » resolves to `currentSeason(now)`. Before 1 Sep 2026 there is no current season, so
the option is hidden rather than shown empty.

---

## Error handling and edge cases

| Case | Behaviour |
|---|---|
| Before 1 Sep 2026 | No current season. Banner announces the start date; stats hides « Cette saison »; ladder defaults to « Tous les temps » |
| Season running, nobody at 10 games | No champion yet. The leader is shown as leader, explicitly not as champion. Common for the first ~2 weeks of every season |
| Season closed, nobody reached 10 games | No champion. Stated plainly; nobody crowned by default |
| Season with zero matches | Empty ladder state, existing empty-state pattern |
| Undated legacy match | « Avant les saisons » — excluded from all season ladders, still counted lifetime |
| Unranked / doubles match | Excluded from season Elo by `ratedMatches`, included in season stats — same as today |
| Unknown season id in a URL | `seasonById` returns null; fall back to the current season, or « Tous les temps » before 1 Sep 2026 |
| Player renamed mid-season | Already handled — `sideKey` keys on `player_a_id`/`player_b_id`, not the name snapshot |

---

## Testing

`seasons.ts` is pure, so this is straight TDD with no fixtures or database.

**`src/lib/seasons.test.ts`**
- boundary arithmetic: 30 Nov 23:59 vs 1 Dec 00:00 land in different seasons
- leap-year February: `hiver-2027` ends at 1 Mar 2028 with no off-by-one
- `hiver-2026` is labelled « 2026-27 » whether derived from a December or a January date
- `seasonOf` returns null before `SEASONS_START` and for a null timestamp
- `seasonsUpTo` is newest-first and excludes seasons that have not started
- `daysLeft` and `isClosed` at both edges of a window

**Champion selection**
- skips provisional rows to crown the highest *eligible* player
- returns null when every row is provisional
- ties break by RD then name, matching `rankRatings`

**Scoped replay** (against the real engine, not a mock)
- a player with history in a previous season starts the new one at exactly 1500 / RD 350
- no RD decay is carried across a boundary
- an unranked tournament inside the window contributes nothing to season Elo

**`statsPage.test.ts`** — « Cette saison » round-trips through the URL and filters to the current
window; the option is absent before 1 Sep 2026.

Then Stryker over the new module, per the MUTATE step of the cycle.

---

## Open questions

None blocking. Two to revisit after the first season closes:

1. Does « Cette saison » make « Ce mois-ci » redundant on the stats page?
2. Is 10 games the right eligibility bar for a three-month season, or should it scale with the
   season's activity?
