# Plan: « Inactif » ladder rule

**Branch**: feat/ladder-inactif
**Status**: Complete — all four steps shipped in PR #48, verified on screen
2026-08-31. The display decision was reversed mid-branch; see Design change.

## Goal

A player who has not played a rated match for 30 days stops holding a rank on the
ladder and is listed in a separate « Inactifs » block, so the leaderboard reflects
who is actually playing — without touching any rating maths.

## Context / why

The Elo engine already handles inactivity the way Glicko intends: `decayRd`
(`rating.ts:253`) inflates RD by `sqrt(rd² + 18²·days)` for time away, so a
returning player's rating moves faster until it re-converges. That is the
*principled* mechanism and it stays exactly as is.

What is missing is a *display* rule. Today's all-time ladder:

| # | Player | Rating | Games | Idle |
|---|--------|--------|-------|------|
| 1 | Thibault | 1903 | 141 | 0 d |
| **2** | **Chris** | **1674** | **14** | **49 d** |
| 3 | Léo | 1565 | 150 | 0 d |
| 4 | Pablo | 1549 | 112 | 0 d |

Chris holds #2 on 14 games having not played in seven weeks, above two players
with 150 and 112 games. `provisionalGames: 10` does not catch him.

Established systems agree on the shape of the fix: FIDE keeps the rating and
*flags* the player inactive; ITTF uses a rolling window plus inactivity
protection; LoL/Overwatch remove decayed players from the *leaderboard view*.
None of them dock skill points for absence — not playing is not evidence of
getting worse, and a decayed rating would also hand out wrong-sized points to
the absent player's next opponent.

**Decisions taken** (2026-08-27):
- Threshold: **30 days** since last rated match.
- Behaviour: **excluded from rank numbering**, kept *inside* the ladder table,
  sorted below every ranked player, greyed, with « — » where the rank number
  goes and « inactif depuis N j » as the row label. **Revised 2026-08-31** —
  originally a separate « Inactifs » block; see Design change.
- Surfaces: **Le Classement**, **Dashboard « Top joueurs »**, **podium/leader**.
  Explicitly *not* Nouvelle Partie or the spectator « Elo en jeu » — those show
  ratings for matchmaking, where inactivity is irrelevant.

## Design constraints

1. **Display-only.** `rating.ts` is not modified. No new DB column, no write to
   `players`, no change to `recomputeRatings`. The engine's stated property —
   *"replaying the same matches in the same order always yields the same
   ratings"* — must still hold. Inactivity is derived at render time from
   `RatingRow.lastPlayedAt`, which already exists.
2. **`now` is injected**, never read inside the lib (matches the existing
   `ladderIdentity({ now })` pattern in `Ratings.tsx:126`). Without this the
   rule is untestable.
3. **Logic lives in `src/lib`**, unit-tested with vitest. The project has no
   component tests and no browser mode; every other extracted-from-component
   module (`classement.ts`, `joueurs.ts`, `statsPage.ts`, `spectator.ts`)
   follows this shape. Components stay thin rendering.
4. **Mirrors `splitLadder`** (`alumni.ts`) deliberately — same "display filter,
   engine untouched" contract, same re-numbering of the survivors.

## Edge cases (settled)

- **Closed / archived seasons**: the rule does **not** apply. A closed season is
  frozen history; everyone in it is trivially "inactive". `Ratings.tsx:164`
  already computes `archived` — gate on it. Open seasons and the all-time
  ladder do apply the rule.
- **Alumni**: already removed by `splitLadder` before the inactif split runs, so
  no one is ever labelled both « ancien » and « inactif ».
- **Provisional**: a player can be both. Inactif wins for placement (they leave
  the numbering either way); the row shows the inactif treatment.
- **`lastPlayedAt === null`**: fail *open* — treat as active. It can only occur
  when a match has neither `ended_at` nor `started_at`, and inventing an
  absence from missing data would be wrong.
- **Returning**: one rated match sets `lastPlayedAt` and the rank is restored on
  the next replay. No grace period, no partial credit.
- **Day counting**: `floor(ms / 86_400_000)`. Threshold is `>= 30`, so day 30
  is inactive. NB: this does *not* match `daysBetween` (`rating.ts:262`), which
  returns fractional days — an earlier draft of this plan claimed it did.
  Flooring is still right: without it, whether day 30 counts would depend on the
  time of day the last match was played. It cannot change who crosses the
  threshold (`floor(x) >= 30` exactly when `x >= 30`), only the number the
  « Inactifs » block prints.

## Acceptance Criteria

- [x] A player whose last rated match is 30+ days old holds no rank number and
      shows « — » in grey, sorted below everyone ranked
- [x] A player at 29 days is still ranked normally
- [x] Removing an inactive player closes the gap in the numbering: the remaining
      players are numbered 1..n with no hole
- [x] An inactive row shows the player's rating and « inactif depuis N j »,
      ordered by rating among the inactive
- [x] An inactive player never shows a streak badge
- [x] The podium (top-3 tinting) and the `leader` highlight never land on an
      inactive player
- [x] Dashboard « Top joueurs » lists only active players, with the ladder's
      own 1..n ranks
- [x] A closed/archived season ladder is unaffected — nobody is marked inactif
- [x] Alumni are unaffected — they remain in « Les Anciens », never inactif
- [x] The copy explains the rule and states the Elo is untouched, reading the
      threshold from `INACTIVITY.days`
- [x] Every player's *rating*, *RD* and replay position are byte-identical to
      before the change (the rule adds no arithmetic)

## Design change (2026-08-31)

Steps 1–3 were built to the original decision: les inactifs in their own block
below the table, mirroring « Les Anciens ». Shipped as `f08084b`, then reversed
on review — a second trailing block was poor UX, and this table *already* had a
house pattern for a player who holds no rank, six lines from the code that built
the block: provisionals render « — » in grey (`Ratings.tsx:467`). Les inactifs
now use that treatment plus a sort to the bottom.

The sort breaks a rule `rankRatings` states in its own docblock — that a label
never pushes a player down the board. Deliberate: provisional means *uncertain*,
inactive means *absent*, and only absence should cost a place.

## Steps

Every step follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code
without a failing test.

### Step 1: Add a pure `inactivity` module that splits a ranked ladder into active and inactive players

**Acceptance criteria**: Given rows carrying `lastPlayedAt` and an injected
`now`, `splitInactive` returns `{ active, inactifs }` where a row 30+ days idle
is in `inactifs`, a row 29 days idle is in `active`, `active` is renumbered
1..n contiguously, `inactifs` is ordered by rating descending and carries the
idle-days count, and a row with `lastPlayedAt === null` stays in `active`.
**Present to human and get confirmation before writing any code.**
**RED**: `src/lib/inactivity.test.ts` — behaviour cases: 29 d stays ranked; 30 d
moves to inactifs; the boundary is inclusive; renumbering closes the gap
(rows ranked 1,2,3 with #2 inactive yield 1,2); null `lastPlayedAt` stays
ranked; `inactifs` ordered by rating; empty input yields empty both.
**GREEN**: `src/lib/inactivity.ts` exporting `INACTIVITY = { days: 30 }`,
`InactifRow = RatingRow & { daysIdle: number }` and `splitInactive(rows, now)`
returning `{ active, inactifs }`. `daysIdle` is module-private and `isInactive`
was never needed — no caller wanted either. Keeping `daysIdle` exported meant its
return for a null date was public behaviour no test stated, which kept a mutant
alive; narrowing the surface retires it as a genuine equivalent. Kept out of `RATING` in
`rating.ts` on purpose: that block is engine tunables, this is a display rule.
**MUTATE**: Run `mutation-testing`. Expect the boundary comparison
(`>=` vs `>`) and the renumbering index to be the interesting mutants.
**KILL MUTANTS**: Add cases until the boundary and the renumbering are pinned.
**REFACTOR**: Only if it adds value — this module should stay ~40 lines.
**Done when**: All criteria met, mutation report reviewed, human approves commit.
**Outcome**: Done bar one listed RED case — empty input yields both halves empty
— which no mutant needs; every other case landed, one behaviour per commit.
`splitInactive` also *depends* on the input arriving in rating order, since the
survivors are renumbered from their position in it; that precondition is now
stated in the docblock rather than sorting one half defensively while the
stronger assumption stayed unguarded.

### Step 2: Show the « Inactifs » block on Le Classement and keep the podium active-only

**Acceptance criteria**: On the all-time ladder and open seasons, players 30+ days
idle no longer appear in the numbered table and instead appear in a distinct
« Inactifs » block below it showing avatar, name, rating and « inactif depuis
N j »; the numbered table has no gaps; `leader` and the top-3 `p1/p2/p3`
tinting resolve against active players only; on a closed/archived season the
table is unchanged and no « Inactifs » block renders.
**RED**: Extend `src/lib/inactivity.test.ts` with a `ladderSections({ rows,
players, season, now, archived })` case set: archived season returns all rows
ranked and zero inactifs; open season applies the split; alumni are routed to
`anciens` and never to `inactifs`. Composing `splitLadder` then `splitInactive`
in one tested function keeps the component free of logic.
**GREEN**: Add `ladderSections` to `inactivity.ts`; in `Ratings.tsx` replace the
`splitLadder` call with it, passing the existing `now` and `archived`. The file
is `src/components/Ratings.tsx`, not `src/pages/`; after the rebase onto
`origin/main` (#47) the anchors are `ladderIdentity` at 160, `archived` at 170,
`splitLadder` at 173 — re-grep rather than trusting these. Render the block reusing the « Les Anciens » markup
and CSS. `leader`/`qualified`/`tableRows` already derive from `ranked`, so the
podium fix falls out — the test above is what proves it.
**MUTATE**: Run `mutation-testing` on `inactivity.ts`.
**KILL MUTANTS**: Focus on the `archived` gate — it must be provable that
flipping it changes behaviour.
**REFACTOR**: Assess whether « Les Anciens » and « Inactifs » should share one
presentational block. Only extract if the markup is genuinely identical.
**Done when**: All criteria met, mutation report reviewed, human approves commit.
**Outcome**: Shipped across five commits. `ladderSections` was driven by the
closed-season case first (`05c8f58`), then the open-season case forced the gate
(`5608373`) — neither alone does, since either is satisfied by a constant. Two
argument-substitution mutants survived Stryker (it does not generate them) and
were killed by tests using an alumnus (`4292aad`, `5d8ec54`). The block landed
in `f08084b` and was replaced by the in-table treatment in `2ab58a6` + `8cf82f5`.
`ladderSections` also returns `table`, the ladder as displayed, so the ordering
rule is tested rather than living in an untested component.

### Step 3: Exclude inactive players from the dashboard « Top joueurs »

**Acceptance criteria**: The dashboard card lists the top 5 *active* players; an
inactive player never appears in it regardless of rating; ranks shown are 1..5
contiguous; the existing empty state still renders when no active player has a
rated match.
**RED**: Test case in `src/lib/inactivity.test.ts` for a `topActive(rows,
players, now, limit)` helper: an inactive high-rated player is absent from the
result; the returned ranks are 1..n; `limit` is respected; all-inactive input
returns empty.
**GREEN**: Add `topActive` to `inactivity.ts`; in `TopPlayers.tsx` replace
`splitLadder(rows, players)` + `.slice(0, 5)` with it, passing `new Date()` at
the component boundary.
**MUTATE**: Run `mutation-testing`.
**KILL MUTANTS**: Address survivors, particularly around `limit` and ordering.
**REFACTOR**: Assess whether `topActive` is just `ladderSections(...).ranked
.slice(0, limit)` — if so, collapse it rather than keeping a second path.
**Outcome**: `3cfdb7b`. **No `topActive` helper** — the assessment above came out
against it, so `TopPlayers.tsx` calls `ladderSections(...).ranked.slice(0, 5)`
directly. A second path to the same answer is what caused the bug: the card
called `splitLadder` itself and so knew about alumni but not inactivity, leaving
Chris at #2 on 1674 while Le Classement had already demoted him. No new test —
no logic was written; this is a call site moving onto an already-pinned rule.

### Step 4: Explain the rule in the Classement copy

**Acceptance criteria**: The Classement footer/explanation states that a player
without a rated match for 30 days leaves the ranking until they play again, and
that their Elo is unchanged while they are away; the number in the copy is read
from `INACTIVITY.days`, not hardcoded; no other copy claims a rating decays.
**RED**: N/A — copy only, no logic. (Note for the TDD gate: this step
deliberately writes no production logic, so there is nothing to drive with a
test. If it grows logic, it moves back to Step 1's shape.)
**GREEN**: Update the hint block near `Ratings.tsx:505` (which already explains
`provisionalGames` the same way) and the « Comment marche l'Elo » rail card.
**MUTATE**: N/A.
**KILL MUTANTS**: N/A.
**REFACTOR**: N/A.
**Done when**: Copy reviewed by human, typecheck passes, human approves commit.
**Outcome**: `99edd2c`. Wording follows what shipped, not this step's text: it
says the player drops to the bottom in grey without a rank, not that they
« leave the ranking », which described the abandoned block. Needed because the
table now greys a row for two unrelated reasons and the note explained only the
provisional one. Both the note and the rail card read `INACTIVITY.days`.

## Out of scope

- Any change to `rating.ts`, `decayRd`, or `rdDecayPerDay`
- Rating-point decay of any kind (explicitly rejected — see Context)
- A persisted `inactive` flag or DB column
- Nouvelle Partie, spectator « Elo en jeu », PlayerModal, Parties history
- The rolling-window « Forme » board discussed as an alternative

## Watch-out

The unmerged branch `origin/claude/elo-ranking-explanation-mgvmc4` (commit
`1cbf871`) rewrites the Classement copy to claim the engine no longer computes a
« ± » deviation. That claim is false — its own `rating.ts` still computes RD —
and it edits the same copy blocks as Step 4. Resolve the conflict in favour of
accurate copy, or drop that branch.

## Pre-PR Quality Gate

1. Mutation testing — run `mutation-testing` skill
2. Refactoring assessment — run `refactoring` skill
3. `npx tsc -b` and lint pass
4. Verify against live data: Chris (49 d) and Solenn (41 d) sit in « Inactifs »;
   Thibault, Léo, Pablo, Candice are ranked 1–4 with no gap; every rating
   unchanged

---
*Kept as the record of a branch whose design changed mid-flight. Delete once
PR #48 is merged and the reasoning has landed in the commit history.*
