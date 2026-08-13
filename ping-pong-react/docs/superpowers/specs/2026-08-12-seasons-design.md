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

Design is **delivered**: prototype and full specification in
[`docs/design/seasons-handoff/`](../../design/seasons-handoff/README.md) (the original request
brief is [`docs/design/seasons-brief.md`](../../design/seasons-brief.md)).

| Surface | File | Change |
|---|---|---|
| Season banner — home | `src/components/Home.tsx` | New. Full-width band under `LiveHero`, as the first row of the 2fr/1fr grid (`grid-column: 1 / -1`). Five visual forms across seven states |
| Season header — ladder | `src/components/Ratings.tsx` | New. Status badge + identity sentence, one per scope |
| Scope selector — ladder | `src/components/Ratings.tsx` | New. Dropdown: current season · past seasons (scrollable) · « Tous les temps » (pinned) |
| Title-race progress | `src/components/Ratings.tsx` | Extends the existing table: games column reads `14 / 10` and turns green at 10. Current-season scope only. (Trimmed from the handoff's separate rail card — see [Fidelity](#fidelity-the-handoff-is-direction-not-a-pixel-spec)) |
| Period filter — stats | `src/lib/statsPage.ts`, `src/components/Stats.tsx` | One added option: `Tout · Cette saison · Ce mois-ci · Cette semaine` |
| Eligibility copy | `src/components/Ratings.tsx` | Table footer rewritten (see [Eligibility copy](#eligibility-copy-is-currently-wrong)) |

The scope selector **grows over time** — nine entries by late 2028, ~20 by 2031, never shrinking.
Design's answer: only the "past seasons" zone scrolls (`max-height: 216px`), while the current
season and « Tous les temps » stay anchored. Each past-season row carries its champion on the
right, which makes the archive double as the palmarès that is out of scope as a page.

« Cette saison » resolves to `currentSeason(now)` — the **season window**, not "the last 90 days".
Before 1 Sep 2026 there is no current season, so the option is hidden rather than shown empty.

### Fidelity: the handoff is direction, not a pixel spec

Build the gist, not the geometry. Colours, radii and shadows come from the codebase's existing
tokens; the handoff's hex values are intent, not values — the one genuine addition is the gold
`#E8B53A`, already used for first place and promoted here to a title accent.

**What ships in v1**, trimmed from the handoff's five forms plus a new rail card down to two new
components:

| Handoff element | Decision |
|---|---|
| Band, forms A/B/C/D | **Keep.** One component, four data-driven forms: pre-season, running, champion, closed-without-champion |
| States 2 and 4 ("no eligible leader", "final days") | **Keep as variants, not states.** Both are form A with a different leader line and pill colour — the handoff says so itself |
| Scope selector + identity sentence | **Keep.** The archive is unreachable without the first, the table ambiguous without the second |
| Champion per row in the dropdown | **Keep.** It is the palmarès, for free, with no new page |
| Gold accent, `CHAMPION · <SAISON>` badge, podium, "here's when it restarts" line | **Keep.** This is the celebration |
| « Cette saison » chip | **Keep.** One entry in `PERIOD_OPTIONS` |
| Footer copy | **Keep** — it corrects a real inaccuracy (below) |
| Form E: bespoke dashed-border empty season | **Trim.** State 9 needs a sentence, not its own visual language. Fold into the neutral card |
| Progress pill inside the banner (§5b) | **Trim.** Duplicates the progress affordance and appears in one state only |
| « Course au titre » rail card (§5a) | **Trim into the existing table.** Show the 10-game progress in the games column — `14 / 10`, turning green at 10 — where people already look. The rail card stays an easy follow-up if that doesn't land |
| Radial halo, three-stop gradients, duplicated light/dark trees | **Trim.** Token work, not design work |

### Design decisions taken in the handoff

The three questions left open for design came back answered, with reasoning worth keeping:

1. **Band, not rail card.** A season needs horizontal room (name + window + leader + Elo +
   progress + countdown on one line, plus a podium when closed), and the rail is already dense.
   Hierarchy is explicit: live match > season > everything else — the band is calm lavender and
   sits *below* the saturated coral hero, so it never competes with a live match.
2. **The champion state gets its own treatment, not the tournament's.** No confetti, no
   `Champion.tsx`, no `FinalStandingsCard`. A tournament is won in front of witnesses and
   celebrated for ten minutes; a season is won at midnight with nobody watching and then sits on
   screen for three months. The chosen form is a deep-violet plaque with a gold rule and a
   `CHAMPION · <SAISON>` badge, closing on the line « Saison Été 2028 · départ le 1er juin, tout le
   monde à 1500 » — so an ageing banner still says what happens next, not only what happened.
3. **« Cette saison » does not replace « Ce mois-ci ».** Three months and one month are genuinely
   different granularities. Order is widest-to-narrowest, with « Cette saison » second because it
   becomes the product's default frame of reference once seasons launch.

### Banner state machine

The handoff specifies an ordered derivation, which becomes a pure function —
`seasonBannerState(...)` — and a direct TDD target:

```
phase === 'pre'                            -> 1  pre-season
ratedCount === 0                           -> 9  season with no games
phase === 'running' && leader.games < 10   -> 2  no eligible leader
phase === 'running' && daysLeft <= 7       -> 4  final days
phase === 'running'                        -> 3  leader known
phase === 'closed' && champion             -> 5  champion crowned
phase === 'closed'                         -> 6  closed, no champion
```

Two corrections to the handoff's version of this, both found while reconciling:

- **The count must be of *rated* matches, not matches.** The handoff guards state 9 on
  `matchCount === 0` and then reads `leader.games` in state 2. If every match in the window belongs
  to a « non classée » tournament — or is a double, which is always unranked — then `matchCount > 0`
  while the rated ladder is empty, `leader` is `null`, and state 2 dereferences null. The guard must
  be the post-`ratedMatches` count, or equivalently `leader === null`.
- **State 4 is unreachable while nobody is eligible.** State 2 is tested before state 4, so a season
  whose final week still has no 10-game player shows a calm violet `J-2` rather than the urgency
  pill. This is defensible — urgency about a title nobody can win is odd — but it follows from
  ordering rather than from a stated intent, so it is recorded here as deliberate.

### Eligibility copy is currently wrong

`src/components/Ratings.tsx:426` reads « Un joueur entre au classement après
{RATING.provisionalGames} matchs. Avant cela, son Elo provisoire s'affiche en gris. »

That does not describe the code: `rankRatings` filters `s.games > 0` (`rating.ts:429`), so a player
appears on the ladder from their **first** match and is merely labelled « Provisoire » and greyed
below 10. There is no entry threshold at all.

The handoff read that line, reasonably inferred two separate thresholds, and specified a footer
describing entry at **5** games and the title at 10 (§5c). **No 5-game threshold exists anywhere in
the codebase** — the only 5 in `classement.ts` is `lastFive`, the form dots.

Correct model, to be written once in the new footer:

- a player appears on the ladder from their first match;
- below `RATING.provisionalGames` (10) the rating is « provisoire » and shown greyed;
- 10 matches **within the season** are required to be eligible for the title.

One threshold, two consequences. Fixing the pre-existing sentence is in scope for this work, since
seasons are what make it actively misleading.

### Scope type

The handoff's view model uses `{ kind: 'current' | 'past' | 'lifetime'; seasonId?: string }`. The
implementation keeps the discriminated union from [Hook change](#hook-change) instead — an optional
`seasonId` that is required for exactly one variant is a state that shouldn't be representable.
`'current'` and `'past'` both map to `{ kind: 'season'; id }`; the current/past distinction is
derived from `isClosed`, not stored.

### Additional helpers

The handoff's banner needs two things the module did not yet expose:

```ts
nextSeason(s: Season): Season          // drives « départ le 1er juin » on the champion plaque
seasonWindowLabel(s: Season): string   // « 1 mars → 31 mai 2028 »
```

The closed-season identity sentence reads « classement final, **figé** ». Under
[Trade-off: recomputed, not frozen](#trade-off-recomputed-not-frozen) the ladder is recomputed, not
frozen — "final" is accurate (no new matches land in a closed window), "figé" overstates it. Prefer
« classement final » alone.

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

**Banner state machine** — one test per branch of `seasonBannerState`, plus the two corrections:
- a window containing only « non classée » / doubles matches yields state 9, not a null dereference
- the final-week season with no eligible player yields state 2, not state 4 (pinning the ordering)
- `nextSeason` crosses the year correctly: `ete-2027` → `automne-2027`, `automne-2026` → `hiver-2026`

**`statsPage.test.ts`** — « Cette saison » round-trips through the URL and filters to the current
season *window* (not a rolling 90 days); the option is absent before 1 Sep 2026; the chip order is
`Tout · Cette saison · Ce mois-ci · Cette semaine`.

Then Stryker over the new module, per the MUTATE step of the cycle.

---

## Open questions

None blocking. Design's three questions came back answered (see
[Design decisions taken in the handoff](#design-decisions-taken-in-the-handoff)). One to revisit
after the first season closes:

- Is 10 games the right eligibility bar for a three-month season, or should it scale with the
  season's activity? A quiet December could produce state 6 (« terminée sans champion ») more often
  than intended, and only a real season's data will show it.
