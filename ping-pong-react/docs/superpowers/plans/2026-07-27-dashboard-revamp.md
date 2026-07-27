# Dashboard Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Home screen (`src/components/Home.tsx`) into a glanceable "living home base" dashboard — a live-match hero, top players, recent results, and streaks — per `design_handoff_dashboard_home/`.

**Architecture:** Extract every non-trivial data derivation into a pure, unit-tested `src/lib/*.ts` module (recent results, live-match pick, records). Then compose small presentational components (`LiveHero`, `RecentResults`, `TopPlayers`, `RecordsCard`, `DashboardNav`, `DashboardTabBar`, `TournamentCard`) that `Home.tsx` orchestrates, wiring existing hooks (`useTournaments`, `useCurrentTournament`, `useTournament`, `useRatings`). No backend or schema changes.

**Tech Stack:** React 18 + TypeScript (strict), Vite, Vitest (pure-logic tests), Supabase realtime hooks (existing), `@tabler/icons-react`, plain CSS in `src/index.css`.

## Global Constraints

- **TDD is mandatory for all new logic** in `src/lib/`. Presentational components + CSS are verified by `npm run build` (typecheck) + manual visual review (repo convention — the maintainer verifies UI himself; do NOT auto-open a browser).
- **No `any`, no unjustified type assertions.** Strict TypeScript. Prefer `type`/`interface` per existing files.
- **Immutable, pure functions** for all `src/lib/` code. No mutation of inputs.
- **Test style:** colocated `src/lib/<name>.test.ts`, `import { describe, expect, it } from 'vitest'`, factory functions with `Partial<T>` overrides (see `src/lib/spectator.test.ts`).
- **French UI copy, sentence case.** Real minus sign for negatives via `signed()` from `src/lib/format.ts`.
- **Visual source of truth:** `design_handoff_dashboard_home/README.md` (exact colors, typography, radii, shadows, motion). Where a hex/token is needed and the codebase has no equivalent, copy it from that README verbatim.
- **Scope exclusions (decided):** the live-hero "Manche 2" and "Arbitré par …" meta lines are dropped (no data); the full-page brand-new-install empty state (handoff frames 1e/1h) is descoped. Per-block empty/loading states stay in.
- **Commit after every task.** Run `npm run test` and `npm run build` green before each commit.

---

## File Structure

**New — pure logic (TDD):**
- `src/lib/recentResults.ts` (+ `.test.ts`) — flatten finished matches across tournaments → recent-result rows.
- `src/lib/liveHero.ts` (+ `.test.ts`) — `isLive` + `pickLiveMatch` (which match the hero shows).
- `src/lib/dashboardRecords.ts` (+ `.test.ts`) — top streak / biggest upset / capots / most active.
- Append to `src/lib/format.ts` (+ `format.test.ts`) — `relativeTime(iso, now)` French relative timestamp.

**New — components (build-verified + manual):**
- `src/components/DashboardNav.tsx` — desktop glass nav bar.
- `src/components/DashboardTabBar.tsx` — mobile bottom tab bar.
- `src/components/LiveHero.tsx` — active + idle hero.
- `src/components/RecentResults.tsx` — recent-results list card.
- `src/components/TopPlayers.tsx` — top-5 Elo card.
- `src/components/RecordsCard.tsx` — streaks & records chips.
- `src/components/TournamentCard.tsx` — one restyled tournament/game card (extracted from `Home.tsx`).
- `src/components/NewMenu.tsx` — the "+ Nouveau" split menu, lifted out of `Home.tsx` so nav + cards share it.

**Modified:**
- `src/hooks/useRatings.ts` — also return `matches` and `players` (already in state; just expose).
- `src/components/LiveView.tsx` — import `isLive` from `liveHero.ts` (DRY; delete the local copy).
- `src/components/Home.tsx` — becomes the dashboard orchestrator.
- `src/index.css` — new `rv*` dashboard classes + tokens.

---

## Task 1: `relativeTime` helper

**Files:**
- Modify: `src/lib/format.ts`
- Test: `src/lib/format.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `relativeTime(iso: string | null, now: Date): string` — French relative timestamp.

- [ ] **Step 1: Write the failing tests** (append to `src/lib/format.test.ts`)

```typescript
import { relativeTime } from './format'

describe('relativeTime', () => {
  const now = new Date('2026-07-27T12:00:00Z')

  it('shows "à l\'instant" under a minute', () => {
    expect(relativeTime('2026-07-27T11:59:30Z', now)).toBe("à l'instant")
  })

  it('shows minutes under an hour', () => {
    expect(relativeTime('2026-07-27T11:40:00Z', now)).toBe('il y a 20 min')
  })

  it('shows hours under a day', () => {
    expect(relativeTime('2026-07-27T09:00:00Z', now)).toBe('il y a 3 h')
  })

  it('shows days under a week', () => {
    expect(relativeTime('2026-07-24T12:00:00Z', now)).toBe('il y a 3 j')
  })

  it('falls back to a short date beyond a week', () => {
    expect(relativeTime('2026-07-01T12:00:00Z', now)).toBe('1 juil.')
  })

  it('returns an empty string for a null timestamp', () => {
    expect(relativeTime(null, now)).toBe('')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/format.test.ts`
Expected: FAIL — `relativeTime is not a function`.

- [ ] **Step 3: Implement** (append to `src/lib/format.ts`)

```typescript
/**
 * A short French "time ago" label for a match's timestamp. Sub-minute reads as
 * "à l'instant"; then minutes, hours, days; beyond a week it falls back to a
 * short localized date. `now` is injected so the formatting is pure/testable.
 */
export function relativeTime(iso: string | null, now: Date): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const secs = Math.max(0, Math.floor((now.getTime() - then) / 1000))
  if (secs < 60) return "à l'instant"
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `il y a ${days} j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/format.test.ts`
Expected: PASS. (If the `toLocaleDateString` output differs by ICU version — e.g. `1 juil.` vs `1 juill.` — adjust the expected string in the test to match the runner's output; the format is locale-data dependent.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat: add relativeTime French timestamp helper"
```

---

## Task 2: Recent-results selector

**Files:**
- Create: `src/lib/recentResults.ts`
- Test: `src/lib/recentResults.test.ts`

**Interfaces:**
- Consumes: `Match`, `Player` from `../types`; `winnerLoser`, `sideKey` from `./stats`.
- Produces:
  - `interface RecentResult { matchId: string; tournamentId: string; winner: string; loser: string; winnerScore: number; loserScore: number; endedAt: string | null; winnerAvatar: string | null }`
  - `recentResults(matches: Match[], players: Player[], limit?: number): RecentResult[]` — finished, non-bye matches, newest first (by `ended_at`, then `started_at`), capped at `limit` (default 5).

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from 'vitest'
import type { Match, Player } from '../types'
import { recentResults } from './recentResults'

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1', tournament_id: 't1', round: 0, idx: 0,
    player_a: 'Alice', player_b: 'Bob', player_a_id: 'pa', player_b_id: 'pb',
    score_a: 11, score_b: 7, done: true, serve_start: 'a',
    started_at: '2026-07-27T10:00:00Z', ended_at: '2026-07-27T10:10:00Z',
    bracket: null, match_key: null, win_to: null, win_slot: null,
    lose_to: null, lose_slot: null, bye: false, mb_saved_a: 0, mb_saved_b: 0,
    ...overrides,
  }
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'pa', created_at: '', name: 'Alice', team: 'Red',
    slack_user_id: null, avatar_url: null, ...overrides,
  }
}

describe('recentResults', () => {
  it('returns the winner, loser and scores of a finished match', () => {
    const [r] = recentResults([makeMatch()], [])
    expect(r).toMatchObject({
      matchId: 'm1', tournamentId: 't1',
      winner: 'Alice', loser: 'Bob', winnerScore: 11, loserScore: 7,
    })
  })

  it('reads the winner from whichever side actually won', () => {
    const [r] = recentResults([makeMatch({ score_a: 5, score_b: 11 })], [])
    expect(r).toMatchObject({ winner: 'Bob', loser: 'Alice', winnerScore: 11, loserScore: 5 })
  })

  it('excludes unfinished and bye matches', () => {
    const rows = recentResults(
      [makeMatch({ id: 'm1', done: false }), makeMatch({ id: 'm2', bye: true })],
      [],
    )
    expect(rows).toEqual([])
  })

  it('orders newest first by ended_at', () => {
    const rows = recentResults([
      makeMatch({ id: 'old', ended_at: '2026-07-27T09:00:00Z' }),
      makeMatch({ id: 'new', ended_at: '2026-07-27T11:00:00Z' }),
    ], [])
    expect(rows.map((r) => r.matchId)).toEqual(['new', 'old'])
  })

  it('caps the list at the limit', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      makeMatch({ id: `m${i}`, ended_at: `2026-07-27T1${i}:00:00Z` }))
    expect(recentResults(many, [], 5)).toHaveLength(5)
  })

  it('resolves the winner avatar by player id', () => {
    const players = [makePlayer({ id: 'pa', name: 'Alice', avatar_url: 'http://x/a.png' })]
    const [r] = recentResults([makeMatch()], players)
    expect(r.winnerAvatar).toBe('http://x/a.png')
  })

  it('falls back to matching the winner avatar by name', () => {
    const players = [makePlayer({ id: 'other', name: 'Alice', avatar_url: 'http://x/a.png' })]
    const [r] = recentResults([makeMatch({ player_a_id: null })], players)
    expect(r.winnerAvatar).toBe('http://x/a.png')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/recentResults.test.ts`
Expected: FAIL — module not found / `recentResults is not a function`.

- [ ] **Step 3: Implement**

```typescript
import type { Match, Player } from '../types'
import { sideKey, winnerLoser } from './stats'

/** One finished game/match, flattened for the dashboard "Résultats récents" list. */
export interface RecentResult {
  matchId: string
  tournamentId: string
  winner: string
  loser: string
  winnerScore: number
  loserScore: number
  endedAt: string | null
  winnerAvatar: string | null
}

function timeKey(m: Match): string {
  return m.ended_at ?? m.started_at ?? ''
}

/**
 * The most recent finished games across every tournament, newest first. Byes
 * are excluded (they aren't real results). Avatars are matched by the same
 * stable identity the rating engine uses — player id, then a name fallback.
 */
export function recentResults(matches: Match[], players: Player[], limit = 5): RecentResult[] {
  const avatarByKey = new Map<string, string | null>()
  for (const p of players) {
    avatarByKey.set(sideKey(p.id, p.name), p.avatar_url)
    avatarByKey.set(`name:${p.name}`, p.avatar_url)
  }

  return matches
    .filter((m) => m.done && !m.bye)
    .sort((a, b) => timeKey(b).localeCompare(timeKey(a)))
    .slice(0, limit)
    .map((m) => {
      const aWon = m.score_a > m.score_b
      const winnerId = aWon ? m.player_a_id : m.player_b_id
      const { winner, loser, ws, ls } = winnerLoser(m)
      const winnerAvatar =
        avatarByKey.get(sideKey(winnerId, winner)) ?? avatarByKey.get(`name:${winner}`) ?? null
      return {
        matchId: m.id,
        tournamentId: m.tournament_id,
        winner,
        loser,
        winnerScore: ws,
        loserScore: ls,
        endedAt: m.ended_at,
        winnerAvatar,
      }
    })
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/recentResults.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recentResults.ts src/lib/recentResults.test.ts
git commit -m "feat: add recentResults dashboard selector"
```

---

## Task 3: Live-hero match picker

**Files:**
- Create: `src/lib/liveHero.ts`
- Test: `src/lib/liveHero.test.ts`
- Modify: `src/components/LiveView.tsx` (import `isLive` instead of the local copy)

**Interfaces:**
- Consumes: `Match` from `../types`.
- Produces:
  - `isLive(m: Match): boolean` — started or has a point and not done.
  - `pickLiveMatch(matches: Match[]): Match | null` — the first in-progress match, else `null`.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from 'vitest'
import type { Match } from '../types'
import { isLive, pickLiveMatch } from './liveHero'

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1', tournament_id: 't1', round: 0, idx: 0,
    player_a: 'Alice', player_b: 'Bob', player_a_id: 'pa', player_b_id: 'pb',
    score_a: 0, score_b: 0, done: false, serve_start: 'a',
    started_at: null, ended_at: null,
    bracket: null, match_key: null, win_to: null, win_slot: null,
    lose_to: null, lose_slot: null, bye: false, mb_saved_a: 0, mb_saved_b: 0,
    ...overrides,
  }
}

describe('isLive', () => {
  it('is true once a point has been scored', () => {
    expect(isLive(makeMatch({ score_a: 3 }))).toBe(true)
  })
  it('is true once the match has an explicit start', () => {
    expect(isLive(makeMatch({ started_at: '2026-07-27T10:00:00Z' }))).toBe(true)
  })
  it('is false for a fresh 0–0 match', () => {
    expect(isLive(makeMatch())).toBe(false)
  })
  it('is false for a finished match', () => {
    expect(isLive(makeMatch({ score_a: 11, score_b: 5, done: true }))).toBe(false)
  })
})

describe('pickLiveMatch', () => {
  it('returns the in-progress match', () => {
    const m = pickLiveMatch([makeMatch({ id: 'a' }), makeMatch({ id: 'b', score_a: 4 })])
    expect(m?.id).toBe('b')
  })
  it('returns null when nothing is live', () => {
    expect(pickLiveMatch([makeMatch(), makeMatch({ done: true, score_a: 11 })])).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/liveHero.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
import type { Match } from '../types'

/** A match is "live" once it has been started or has at least one point. */
export function isLive(m: Match): boolean {
  return !m.done && (m.score_a + m.score_b > 0 || !!m.started_at)
}

/** The match the dashboard hero should feature: the one in progress, else null. */
export function pickLiveMatch(matches: Match[]): Match | null {
  return matches.find(isLive) ?? null
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/liveHero.test.ts`
Expected: PASS.

- [ ] **Step 5: DRY up `LiveView`** — in `src/components/LiveView.tsx`, delete the local `isLive` function (the `function isLive(m: Match): boolean { ... }` near the top) and add it to the existing imports so the definition lives in one place:

```typescript
import { isLive } from "../lib/liveHero";
```

- [ ] **Step 6: Verify build + full suite**

Run: `npm run build && npm run test`
Expected: typecheck clean, all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/liveHero.ts src/lib/liveHero.test.ts src/components/LiveView.tsx
git commit -m "feat: add liveHero match picker and share isLive with LiveView"
```

---

## Task 4: Dashboard records selector

**Files:**
- Create: `src/lib/dashboardRecords.ts`
- Test: `src/lib/dashboardRecords.test.ts`

**Interfaces:**
- Consumes: `Match` from `../types`; `PlayerStat`, `isCapot` from `./stats`; `RatingEvent` from `./rating` (also re-exported by `../hooks/useRatings`).
- Produces:
  - `interface DashboardRecords { topStreak: { name: string; avatar_url: string | null; streak: number } | null; biggestUpset: { winner: string; loser: string; gain: number } | null; capots: number; mostActive: { name: string; played: number } | null }`
  - `dashboardRecords(stats: PlayerStat[], matches: Match[], events: RatingEvent[]): DashboardRecords`

**Note on `RatingEvent`:** an upset = the winner's `ratingBefore` was lower than the loser's; magnitude = that rating gap; the reported `gain` is the winner's rounded `delta`. Before writing the test factory, open `src/lib/rating.ts` and copy the real `RatingEvent` type so the `ev()` factory below matches it exactly (especially the `stakes` field shape).

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from 'vitest'
import type { Match } from '../types'
import type { PlayerStat } from './stats'
import type { RatingEvent } from './rating'
import { dashboardRecords } from './dashboardRecords'

function makeStat(overrides: Partial<PlayerStat> = {}): PlayerStat {
  return {
    key: 'pa', name: 'Alice', team: null, avatar_url: null,
    played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, diff: 0,
    winRate: 0, currentStreak: 0, longestStreak: 0,
    capotsDealt: 0, capotsTaken: 0, matchBallsSaved: 0, matchBallsWasted: 0,
    ...overrides,
  }
}

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1', tournament_id: 't1', round: 0, idx: 0,
    player_a: 'Alice', player_b: 'Bob', player_a_id: 'pa', player_b_id: 'pb',
    score_a: 11, score_b: 0, done: true, serve_start: 'a',
    started_at: null, ended_at: null,
    bracket: null, match_key: null, win_to: null, win_slot: null,
    lose_to: null, lose_slot: null, bye: false, mb_saved_a: 0, mb_saved_b: 0,
    ...overrides,
  }
}

// Adjust `stakes` to the real RatingEvent shape from rating.ts before running.
function ev(overrides: Partial<RatingEvent> = {}): RatingEvent {
  return {
    matchId: 'm1', key: 'pa', name: 'Alice', delta: 0,
    ratingBefore: 1500, ratingAfter: 1500, won: false,
    stakes: { win: 0, loss: 0 },
    ...overrides,
  } as RatingEvent
}

describe('dashboardRecords', () => {
  it('picks the player with the longest current win streak (min 2)', () => {
    const stats = [
      makeStat({ name: 'Alice', currentStreak: 4, avatar_url: 'a.png' }),
      makeStat({ name: 'Bob', currentStreak: 2 }),
    ]
    expect(dashboardRecords(stats, [], []).topStreak)
      .toEqual({ name: 'Alice', avatar_url: 'a.png', streak: 4 })
  })

  it('has no top streak when nobody is on a 2+ run', () => {
    expect(dashboardRecords([makeStat({ currentStreak: 1 })], [], []).topStreak).toBeNull()
  })

  it('counts capots across finished matches', () => {
    const matches = [makeMatch({ id: 'm1', score_b: 0 }), makeMatch({ id: 'm2', score_b: 7 })]
    expect(dashboardRecords([], matches, []).capots).toBe(1)
  })

  it('picks the most active player by games played', () => {
    const stats = [makeStat({ name: 'Alice', played: 3 }), makeStat({ name: 'Bob', played: 9 })]
    expect(dashboardRecords(stats, [], []).mostActive).toEqual({ name: 'Bob', played: 9 })
  })

  it('finds the biggest upset: a lower-rated winner beating a higher-rated loser', () => {
    const events = [
      ev({ matchId: 'm1', key: 'pa', name: 'Alice', won: true, ratingBefore: 1400, delta: 21 }),
      ev({ matchId: 'm1', key: 'pb', name: 'Bob', won: false, ratingBefore: 1600, delta: -21 }),
    ]
    expect(dashboardRecords([], [], events).biggestUpset)
      .toEqual({ winner: 'Alice', loser: 'Bob', gain: 21 })
  })

  it('ignores non-upsets (favourite won)', () => {
    const events = [
      ev({ matchId: 'm1', key: 'pa', won: true, ratingBefore: 1600 }),
      ev({ matchId: 'm1', key: 'pb', won: false, ratingBefore: 1400 }),
    ]
    expect(dashboardRecords([], [], events).biggestUpset).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/dashboardRecords.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
import type { Match } from '../types'
import type { RatingEvent } from './rating'
import { isCapot, type PlayerStat } from './stats'

export interface DashboardRecords {
  topStreak: { name: string; avatar_url: string | null; streak: number } | null
  biggestUpset: { winner: string; loser: string; gain: number } | null
  capots: number
  mostActive: { name: string; played: number } | null
}

function topStreakOf(stats: PlayerStat[]): DashboardRecords['topStreak'] {
  const best = [...stats]
    .filter((s) => s.currentStreak >= 2)
    .sort((a, b) => b.currentStreak - a.currentStreak || a.name.localeCompare(b.name))[0]
  return best ? { name: best.name, avatar_url: best.avatar_url, streak: best.currentStreak } : null
}

function mostActiveOf(stats: PlayerStat[]): DashboardRecords['mostActive'] {
  const best = [...stats]
    .filter((s) => s.played > 0)
    .sort((a, b) => b.played - a.played || a.name.localeCompare(b.name))[0]
  return best ? { name: best.name, played: best.played } : null
}

function biggestUpsetOf(events: RatingEvent[]): DashboardRecords['biggestUpset'] {
  const byMatch = new Map<string, RatingEvent[]>()
  for (const e of events) {
    const arr = byMatch.get(e.matchId)
    if (arr) arr.push(e)
    else byMatch.set(e.matchId, [e])
  }
  let best: DashboardRecords['biggestUpset'] = null
  let bestGap = 0
  for (const evs of byMatch.values()) {
    const winner = evs.find((e) => e.won)
    const loser = evs.find((e) => !e.won)
    if (!winner || !loser) continue
    const gap = loser.ratingBefore - winner.ratingBefore
    if (gap > 0 && gap > bestGap) {
      bestGap = gap
      best = { winner: winner.name, loser: loser.name, gain: Math.round(winner.delta) }
    }
  }
  return best
}

/**
 * The flavor stats for the dashboard "Séries & records" card. Each field is
 * independently nullable so the card degrades gracefully when data is thin.
 */
export function dashboardRecords(
  stats: PlayerStat[],
  matches: Match[],
  events: RatingEvent[],
): DashboardRecords {
  return {
    topStreak: topStreakOf(stats),
    biggestUpset: biggestUpsetOf(events),
    capots: matches.filter((m) => m.done && !m.bye && isCapot(m)).length,
    mostActive: mostActiveOf(stats),
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/dashboardRecords.test.ts`
Expected: PASS. If the `ev()` factory doesn't typecheck against the real `RatingEvent`, fix the factory (test-only) — do not change the implementation.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboardRecords.ts src/lib/dashboardRecords.test.ts
git commit -m "feat: add dashboardRecords selector (streak, upset, capots, most active)"
```

---

## Task 5: Expose `matches` + `players` from `useRatings`

**Files:**
- Modify: `src/hooks/useRatings.ts`

**Interfaces:**
- Produces: `useRatings()` return object additionally includes `matches: Match[]` and `players: Player[]` (both already in the hook's state).

- [ ] **Step 1: Add the two fields to the returned object** (in `src/hooks/useRatings.ts`, the final `return { ... }`)

```typescript
  return {
    rows,
    events,
    matches,
    players,
    matchCount: matches.length,
    loading,
    error,
    reload: refresh,
    recompute,
  }
```

- [ ] **Step 2: Verify build + full suite**

Run: `npm run build && npm run test`
Expected: typecheck clean (both symbols already typed as `Match[]`/`Player[]`), all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useRatings.ts
git commit -m "feat: expose matches and players from useRatings for the dashboard"
```

---

## Task 6: Dashboard shell — nav bar, tab bar, gradient, grid

Rebuild `Home.tsx`'s frame: the desktop glass nav bar, the mobile bottom tab bar, the house-gradient background, and the 2fr/1fr grid — with the *existing* tournament cards + `NewMenu` re-homed into the main column so nothing regresses. Live hero / recent / top players / records land in later tasks as placeholders now.

**Files:**
- Create: `src/components/DashboardNav.tsx`, `src/components/DashboardTabBar.tsx`, `src/components/TournamentCard.tsx`, `src/components/NewMenu.tsx`
- Modify: `src/components/Home.tsx`, `src/index.css`

**Interfaces:**
- Consumes: existing `Home` props (`onOpen`, `onNew`, `onNewGame`, `onPlayers`, `onStats`, `onClassement`, `onPronos`, `onLive`, `onRef`); `useTournaments`; `deleteTournament`, `splitOnWinner`.
- Produces:
  - `NewMenu` props: `{ onNew: () => void; onNewGame: () => void }` (moved verbatim out of `Home.tsx`, lines ~9-116).
  - `DashboardNav` props: `{ onClassement; onPronos; onStats; onPlayers; onNew; onNewGame }`.
  - `DashboardTabBar` props: `{ onClassement; onStats; onPlayers; onNew; onNewGame }`.
  - `TournamentCard` props: `{ tournament: Tournament; onOpen: (id: string) => void; onDelete: (e: MouseEvent, id: string, name: string) => void }`.

- [ ] **Step 1: Lift `NewMenu` into `src/components/NewMenu.tsx`** — cut the `NewMenu` component (and its `IconChevronDown` import) out of `Home.tsx` into its own file, exported as `export default function NewMenu`. No behavior change. Import it back into `Home.tsx`.

- [ ] **Step 2: Add dashboard CSS** — append an `rv*` block to `src/index.css`. Use the exact tokens from `design_handoff_dashboard_home/README.md` §"Design Tokens" (house gradient bg, glass surfaces, radii 14–22px, purple `#4A2AA4`, coral hero gradient, soft purple-tinted shadows, `@keyframes rvpulse`/`rvpulseC`). Minimum classes to define now: `.rv-page` (gradient bg + max-width container), `.rv-nav` (glass card) + `.rv-nav-link` / `.rv-nav-link.active`, `.rv-grid` (`grid-template-columns: 2fr 1fr; gap: 20px; align-items: start`), `.rv-main`, `.rv-side`, `.rv-card` (white/dark surface, radius 18px), `.rvcard` (hover lift `translateY(-2px)`), `.rvtrash`, `.rv-tabbar` + `.rv-tab` + `.rv-tab-plus`. Add the responsive breakpoint (~820px) that collapses `.rv-grid` to one column, hides `.rv-nav`, and shows `.rv-tabbar`. Wrap all transforms/pulses so `@media (prefers-reduced-motion: reduce)` disables them.

- [ ] **Step 3: Create `TournamentCard.tsx`** — extract the existing card markup from `Home.tsx` (lines ~217-262) into this component, restyled with `.rvcard`/`.rvtrash` and the status-badge treatment from the README ("EN COURS" coral pill w/ pulse; "TERMINÉ" green outline; winner name highlighted). Keep behavior identical: card click → `onOpen(tournament.id)`, trash → `onDelete`. Preserve the `splitOnWinner` winner-highlight for finished quick games.

- [ ] **Step 4: Create `DashboardNav.tsx`** — glass top bar: brand tile + wordmark ("Tournoi ping-pong", "ping-pong" tinted), links `Accueil` (active) · `Classement` · `Pronos` · `Stats` · `Joueurs` wired to the callbacks, `ThemeToggle`, and `<NewMenu onNew={onNew} onNewGame={onNewGame} />` as the "+ Nouveau" CTA.

- [ ] **Step 5: Create `DashboardTabBar.tsx`** — fixed bottom glass bar: `Accueil · Classement · (+) · Stats · Joueurs`, center raised `+` rendering `<NewMenu/>` (Pronos folds into Classement). Icons from `@tabler/icons-react` (`IconHome`, `IconTrophy`, `IconChartBar`, `IconUsers`, `IconPlus`).

- [ ] **Step 6: Rewrite `Home.tsx`** as the orchestrator: `.rv-page` → `<DashboardNav …/>` → placeholder `<div className="rv-hero-slot" />` (hero lands in Task 7) → `.rv-grid` with `.rv-main` (section title "Tes tournois & parties" + tournaments mapped to `<TournamentCard/>` + a dashed "Nouveau" card that triggers `NewMenu`, then a `<div className="rv-recent-slot" />` placeholder) and `.rv-side` (`<div className="rv-top-slot" />` + `<div className="rv-records-slot" />` placeholders) → `<DashboardTabBar …/>`. Keep `useTournaments` loading/error/empty states. Keep the existing `onDelete` confirm handler.

- [ ] **Step 7: Verify build + suite**

Run: `npm run build && npm run test`
Expected: typecheck clean, all tests PASS.

- [ ] **Step 8: Manual visual check** — `npm run dev`: on desktop the nav bar + grid render and tournament cards open/delete; narrow the window to confirm the bottom tab bar appears and the grid collapses to one column. (Maintainer verifies visuals.)

- [ ] **Step 9: Commit**

```bash
git add src/components/NewMenu.tsx src/components/DashboardNav.tsx src/components/DashboardTabBar.tsx src/components/TournamentCard.tsx src/components/Home.tsx src/index.css
git commit -m "feat: dashboard shell — nav bar, bottom tab bar, gradient, 2-col grid"
```

---

## Task 7: Live hero (active + idle)

**Files:**
- Create: `src/components/LiveHero.tsx`
- Modify: `src/components/Home.tsx`, `src/index.css`

**Interfaces:**
- Consumes: `useCurrentTournament` (→ `id`), `useTournament(id)` (→ `matches`, `tournament`), `pickLiveMatch` from `../lib/liveHero`, `serverIsA` from `../lib/pingpong`, `useRatings` `rows` for per-player Elo + `sideKey` from `../lib/stats`, `Avatar`.
- Produces: `LiveHero` props `{ onWatch: () => void; onRef: () => void; onNew: () => void }` — renders the coral active hero when `pickLiveMatch(matches)` is non-null, else the slim glass idle band.

- [ ] **Step 1: Build `LiveHero.tsx`.** Resolve `const { id } = useCurrentTournament()`; `const { tournament, matches } = useTournament(id)`; `const live = pickLiveMatch(matches)`; `const { rows } = useRatings()`.
  - **Active (`live` && `tournament`):** coral gradient card (README §"Live hero — ACTIVE"): pulsing LIVE dot + "EN DIRECT", `Jeu en {tournament.target}` (NO "Manche"/"Arbitré par"), both players via `<Avatar name team url>` with a white ring, big score `{live.score_a} – {live.score_b}`, each player's Elo from `rows.find(r => r.key === sideKey(live.player_a_id, live.player_a))?.rating` (round it), and an "au service" marker on side A when `serverIsA(live, tournament.target)` is true, else side B. Actions: **Regarder** (white primary) → `onWatch`; **Arbitrer** (translucent secondary) → `onRef`.
  - **Idle (no `live`):** slim glass band (README §"Live hero — IDLE"): clock tile + "Aucun match en cours" + subline "Lance une partie — le score en direct apparaîtra ici pour tout le bureau." + **"+ Nouveau match"** (purple) → `onNew` and a "Mode présentation" ghost → `onWatch`.
  - While `id` resolves (`useCurrentTournament().loading`) render the idle band (never a flash of nothing).
- [ ] **Step 2: Wire into `Home.tsx`** — replace the `rv-hero-slot` placeholder with `<LiveHero onWatch={onLive} onRef={onRef} onNew={onNew} />`.
- [ ] **Step 3: Add hero CSS** to `src/index.css` (coral gradient `linear-gradient(105deg,#D74251,#BE3341 55%,#93283A)`, avatar ring, score type scale 56/900 desktop · 42/900 mobile, `rvpulse` dot) from the README.
- [ ] **Step 4: Verify build + suite** — `npm run build && npm run test` → green.
- [ ] **Step 5: Manual check** — with a live match on the table the coral hero shows correct score/serving/Elo; with none, the idle band shows. (Maintainer verifies.)
- [ ] **Step 6: Commit**

```bash
git add src/components/LiveHero.tsx src/components/Home.tsx src/index.css
git commit -m "feat: dashboard live hero (active coral + idle invite band)"
```

---

## Task 8: Recent results list

**Files:**
- Create: `src/components/RecentResults.tsx`
- Modify: `src/components/Home.tsx`

**Interfaces:**
- Consumes: `useRatings()` (`matches`, `players`), `recentResults` from `../lib/recentResults`, `relativeTime` from `../lib/format`, `Avatar`.
- Produces: `RecentResults` props `{ onOpenTournament: (id: string) => void }`.

- [ ] **Step 1: Build `RecentResults.tsx`** — `const { matches, players } = useRatings(); const rows = recentResults(matches, players, 5)`. Card (`.rv-card`) titled "Résultats récents". Each row (`.rvrow`, clickable): winner `<Avatar>`, text "**{winner}** bat {loser} · **{winnerScore}–{loserScore}**" (winner name + score emphasized; connective "bat" muted), right-aligned `relativeTime(endedAt, new Date())`, a chevron. Row click → `onOpenTournament(tournamentId)`. Empty state when `rows.length === 0`: "Aucun match terminé pour l'instant."
- [ ] **Step 2: Wire into `Home.tsx`** — replace the `rv-recent-slot` placeholder in `.rv-main` with `<RecentResults onOpenTournament={onOpen} />`.
- [ ] **Step 3: Verify build + suite** — `npm run build && npm run test` → green.
- [ ] **Step 4: Manual check** — recent finished games list newest-first with correct relative times; clicking a row opens its tournament. (Maintainer verifies.)
- [ ] **Step 5: Commit**

```bash
git add src/components/RecentResults.tsx src/components/Home.tsx
git commit -m "feat: dashboard recent results list"
```

---

## Task 9: Top players card

**Files:**
- Create: `src/components/TopPlayers.tsx`
- Modify: `src/components/Home.tsx`

**Interfaces:**
- Consumes: `useRatings()` (`rows` — ranked `RatingRow[]` with `name`, `rating`, `rank`, `avatar_url`, `team`, `trend`), `Avatar`, `signed` from `../lib/format`.
- Produces: `TopPlayers` props `{ onOpenClassement: () => void }`.

- [ ] **Step 1: Build `TopPlayers.tsx`** — `const { rows } = useRatings(); const top = rows.slice(0, 5)`. Card (`.rv-card`), whole card clickable → `onOpenClassement`; header "Top joueurs" + a "Classement →" affordance. Each row: rank number (1/2/3 tinted gold `#E8B53A` / silver `#AEB6C0` / bronze `#CB8E5E`, 4–5 muted), `<Avatar name team url>`, name, `Math.round(row.rating)` (rank 1 in purple), and the trend arrow — green ▲ / red ▼ with `signed(row.trend)`, hidden when `row.trend === 0`. Empty state when `rows.length === 0`: "Encore aucun match classé."
- [ ] **Step 2: Wire into `Home.tsx`** — replace the `rv-top-slot` placeholder in `.rv-side` with `<TopPlayers onOpenClassement={onClassement} />`.
- [ ] **Step 3: Verify build + suite** — `npm run build && npm run test` → green.
- [ ] **Step 4: Manual check** — top 5 with medals, ratings, trend arrows; card opens Classement. (Maintainer verifies.)
- [ ] **Step 5: Commit**

```bash
git add src/components/TopPlayers.tsx src/components/Home.tsx
git commit -m "feat: dashboard top players card"
```

---

## Task 10: Streaks & records card

**Files:**
- Create: `src/components/RecordsCard.tsx`
- Modify: `src/components/Home.tsx`

**Interfaces:**
- Consumes: `useRatings()` (`matches`, `players`, `events`), `computePlayerStats` from `../lib/stats`, `dashboardRecords` from `../lib/dashboardRecords`, `signed` from `../lib/format`.
- Produces: `RecordsCard` (no props).

- [ ] **Step 1: Build `RecordsCard.tsx`** — `const { matches, players, events } = useRatings(); const stats = computePlayerStats(matches, players); const rec = dashboardRecords(stats, matches, events)`. Card (`.rv-card`) "Séries & records" with chips, each rendered only when its field is non-null (graceful degradation):
  - `rec.topStreak` → flame chip: "{name} · {streak} victoires d'affilée".
  - `rec.biggestUpset` → trending-up chip: "{winner} a battu {loser} · {signed(gain)} Elo".
  - `rec.capots > 0` and `rec.mostActive` → two half-width stat tiles ("{capots} capots", "{mostActive.name} · {mostActive.played} matchs").
  - If every field is empty/zero, render "Les records arrivent après quelques matchs."
- [ ] **Step 2: Wire into `Home.tsx`** — replace the `rv-records-slot` placeholder in `.rv-side` with `<RecordsCard />`.
- [ ] **Step 3: Verify build + suite** — `npm run build && npm run test` → green.
- [ ] **Step 4: Manual check** — chips reflect current data; a thin-data install shows fallbacks, never a broken card. (Maintainer verifies.)
- [ ] **Step 5: Commit**

```bash
git add src/components/RecordsCard.tsx src/components/Home.tsx
git commit -m "feat: dashboard streaks & records card"
```

---

## Task 11: Responsive, dark theme & motion polish

**Files:**
- Modify: `src/index.css` (and any component needing a dark-variant class)

- [ ] **Step 1: Dark theme pass** — verify every new surface has its dark values from the README (nav/glass `rgba(255,255,255,.05)`, cards `#1E1138`, dark accents `#C9B8FF`/`#A99FC4`, dark house gradient over `#130726`). The coral live hero stays coral in both themes. Follow how `src/index.css` already scopes dark styles (inspect the existing dark selector — e.g. a `data-theme`/class on the root that `ThemeToggle`/`useTheme` sets — and mirror it).
- [ ] **Step 2: Responsive stack order** — confirm the mobile single-column order is Live hero → Tes tournois & parties → Top joueurs → Résultats récents → Séries & records (README §"Mobile layout"). If the DOM order differs, set CSS `order` on the grid/section children at the mobile breakpoint.
- [ ] **Step 3: Motion** — entrances fade + `translateY(8–12px)` ~220ms, hover lifts ~160ms `cubic-bezier(.2,.7,.2,1)`, live pulses; all wrapped so `@media (prefers-reduced-motion: reduce)` disables transforms and pulse animations.
- [ ] **Step 4: Verify build + suite** — `npm run build && npm run test` → green.
- [ ] **Step 5: Manual check** — toggle light/dark on desktop and mobile widths; verify reduced-motion. (Maintainer verifies.)
- [ ] **Step 6: Commit**

```bash
git add src/index.css
git commit -m "feat: dashboard responsive, dark theme and reduced-motion polish"
```

---

## Self-Review Notes

- **Spec coverage:** nav bar (T6) · live hero active+idle (T7) · tournament cards + trash (T6) · recent results + tap-through (T2/T8) · top players + Δ (T9) · streaks/records with graceful degradation (T4/T10) · responsive + bottom tab bar (T6/T11) · dark theme + motion + reduced-motion (T11) · dropped Manche/referee (T7) · descoped full-page empty state, per-block empty states covered (T7–T10). Every spec section maps to a task.
- **Type consistency:** `recentResults`/`RecentResult`, `pickLiveMatch`/`isLive`, `dashboardRecords`/`DashboardRecords`, `NewMenu`, and the `useRatings` `matches`/`players`/`events` additions are referenced with identical names across tasks.
- **Data-shape risk pinned:** the one external shape the plan can't fully assert from what's read is `RatingEvent.stakes` (Task 4 test factory) — Task 4's note + Step 4 tell the implementer to reconcile the factory with `rating.ts` (test-only). `computePlayerStats(matches, players)` signature and `RatingRow`/`PlayerStat` fields used are taken from the actual source.
- **Ordering:** Tasks 1–5 are pure/low-risk and independently shippable; 6 establishes the frame; 7–10 fill slots one card at a time (each independently reviewable); 11 is the cross-cutting polish. A reviewer can accept/reject any single task without blocking its neighbors.
```