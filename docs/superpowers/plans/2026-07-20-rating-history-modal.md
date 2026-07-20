# Player Rating History Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a player row in the Classement opens a chess.com-style modal: rating-over-time SVG chart, best rating, rank, percentile, and W/L record.

**Architecture:** Pure derivation from the in-memory Glicko replay already exposed by `useRatings()` (`events` + `rows`) — no new queries, no schema changes. Two new pure lib modules (data derivation + chart geometry), one SVG chart component, one modal component, and a small wiring edit in `Ratings.tsx`.

**Tech Stack:** React 18 + TypeScript strict, Vitest, hand-rolled SVG (no chart lib), CSS custom properties for theming.

**Spec:** `docs/superpowers/specs/2026-07-20-rating-history-design.md`

## Global Constraints

- TypeScript strict; no `any`, no type assertions.
- All UI strings in **French**.
- Immutable data, pure functions in `src/lib`; components stay thin.
- Code style in `src/lib` and `Ratings.tsx`/`Charts.tsx`: 2-space indent, no semicolons, single quotes (match the file you touch).
- Theming only via existing CSS variables (`--fg-1/2/3`, `--border`, `--surface`, `--surface-hover`, `--scrim`, `--font-display`); must look right in light AND dark.
- TDD: no production code without a failing test first. Tests run with `npx vitest run <file>`.
- Work on branch `feat/rating-history` off `main`. Repo root is the parent dir (`Ping Pong Tournament/`); app lives in `ping-pong-react/`. All `npm`/`npx` commands run from `ping-pong-react/`.
- Reuse, don't reinvent: modal = existing `scrim` + `modal pd` pattern (see `Stats.tsx` `PlayerDetail`), avatar markup as in `Ratings.tsx`, `shortDay` date formatter in `Charts.tsx`, `teamColor`/`teamLabel` from `src/lib/teams.ts`.

---

### Task 1: `playerHistory` derivation lib

**Files:**
- Create: `ping-pong-react/src/lib/playerHistory.ts`
- Test: `ping-pong-react/src/lib/playerHistory.test.ts`

**Interfaces:**
- Consumes: `RatingEvent`, `RatingRow`, `RATING` from `./rating` (existing; `RatingEvent.key` and `RatingRow.key` are the stable player identity; `RATING.R0 === 1500`; `RatingRow.peak`, `.rank` already computed; `events` arrive in chronological replay order).
- Produces (used by Tasks 4–5):

```ts
export interface PlayerHistoryPoint { at: string | null; rating: number }
export interface PlayerHistory {
  points: PlayerHistoryPoint[]
  peak: number
  rank: number
  total: number
  percentile: number   // 0..1
  wins: number
  losses: number
  games: number
  winRate: number      // 0..1
}
export function playerHistory(
  events: RatingEvent[], rows: RatingRow[], playerKey: string,
): PlayerHistory | null
```

- [ ] **Step 0: Create the branch**

```bash
cd "/Users/thibault/Documents/Claude/Projects/Ping Pong Tournament" && git checkout -b feat/rating-history main
```

- [ ] **Step 1: Write the failing tests**

Create `ping-pong-react/src/lib/playerHistory.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { playerHistory } from './playerHistory'
import type { RatingEvent, RatingRow } from './rating'

const event = (over: Partial<RatingEvent> = {}): RatingEvent => ({
  matchId: 'm1',
  key: 'alice',
  playerId: 'alice',
  name: 'Alice',
  opponentKey: 'bob',
  opponentName: 'Bob',
  scoreFor: 11,
  scoreAgainst: 5,
  ratingBefore: 1500,
  ratingAfter: 1512,
  rdBefore: 350,
  rdAfter: 300,
  delta: 12,
  weight: 1,
  stakes: 'normal',
  won: true,
  at: '2026-07-01T10:00:00Z',
  ...over,
})

const row = (over: Partial<RatingRow> = {}): RatingRow => ({
  key: 'alice',
  playerId: 'alice',
  name: 'Alice',
  rating: 1512,
  rd: 300,
  vol: 0.06,
  games: 1,
  peak: 1512,
  lastPlayedAt: '2026-07-01T10:00:00Z',
  rank: 1,
  provisional: true,
  team: 'tech',
  trend: 12,
  ...over,
})

describe('playerHistory', () => {
  it('returns null for a player with no rated matches', () => {
    expect(playerHistory([], [row()], 'alice')).toBeNull()
  })

  it('returns null for a player missing from the ranked rows', () => {
    expect(playerHistory([event()], [], 'alice')).toBeNull()
  })

  it('anchors the chart at 1500 then follows each match rating, in order', () => {
    const events = [
      event({ matchId: 'm1', ratingAfter: 1512, at: '2026-07-01T10:00:00Z' }),
      event({ matchId: 'm2', ratingAfter: 1498, won: false, at: '2026-07-02T10:00:00Z' }),
      event({ matchId: 'm3', ratingAfter: 1520, at: '2026-07-03T10:00:00Z' }),
    ]
    const h = playerHistory(events, [row()], 'alice')
    expect(h?.points).toEqual([
      { at: null, rating: 1500 },
      { at: '2026-07-01T10:00:00Z', rating: 1512 },
      { at: '2026-07-02T10:00:00Z', rating: 1498 },
      { at: '2026-07-03T10:00:00Z', rating: 1520 },
    ])
  })

  it("ignores other players' events", () => {
    const events = [event(), event({ matchId: 'm2', key: 'bob', name: 'Bob', won: false })]
    const h = playerHistory(events, [row()], 'alice')
    expect(h?.games).toBe(1)
    expect(h?.points).toHaveLength(2)
  })

  it('counts wins, losses and win rate from the won flags', () => {
    const events = [
      event({ matchId: 'm1', won: true }),
      event({ matchId: 'm2', won: true }),
      event({ matchId: 'm3', won: true }),
      event({ matchId: 'm4', won: false }),
    ]
    const h = playerHistory(events, [row()], 'alice')
    expect(h?.wins).toBe(3)
    expect(h?.losses).toBe(1)
    expect(h?.games).toBe(4)
    expect(h?.winRate).toBe(0.75)
  })

  it('reads peak, rank and total from the ranked rows', () => {
    const rows = [
      row({ key: 'bob', name: 'Bob', rank: 1 }),
      row({ rank: 2, peak: 1540 }),
      row({ key: 'carol', name: 'Carol', rank: 3 }),
    ]
    const h = playerHistory([event()], rows, 'alice')
    expect(h?.peak).toBe(1540)
    expect(h?.rank).toBe(2)
    expect(h?.total).toBe(3)
  })

  it('gives the leader percentile 1 and the last place percentile 0', () => {
    const rows = [
      row({ rank: 1 }),
      row({ key: 'bob', name: 'Bob', rank: 2 }),
      row({ key: 'carol', name: 'Carol', rank: 3 }),
    ]
    expect(playerHistory([event()], rows, 'alice')?.percentile).toBe(1)
    expect(
      playerHistory([event({ key: 'carol', name: 'Carol' })], rows, 'carol')?.percentile,
    ).toBe(0)
  })

  it('gives the middle of three players percentile 0.5', () => {
    const rows = [
      row({ key: 'bob', name: 'Bob', rank: 1 }),
      row({ rank: 2 }),
      row({ key: 'carol', name: 'Carol', rank: 3 }),
    ]
    expect(playerHistory([event()], rows, 'alice')?.percentile).toBe(0.5)
  })

  it('gives a lone ranked player percentile 1', () => {
    expect(playerHistory([event()], [row()], 'alice')?.percentile).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/thibault/Documents/Claude/Projects/Ping Pong Tournament/ping-pong-react" && npx vitest run src/lib/playerHistory.test.ts
```

Expected: FAIL — `Cannot find module './playerHistory'` (or equivalent resolve error).

- [ ] **Step 3: Write the implementation**

Create `ping-pong-react/src/lib/playerHistory.ts`:

```ts
import { RATING, type RatingEvent, type RatingRow } from './rating'

/** One point of a player's rating trajectory (the first has `at: null`). */
export interface PlayerHistoryPoint {
  at: string | null
  rating: number
}

/** Everything the player modal shows, derived from the live replay. */
export interface PlayerHistory {
  points: PlayerHistoryPoint[]
  peak: number
  rank: number
  total: number
  percentile: number
  wins: number
  losses: number
  games: number
  winRate: number
}

/**
 * Derive a player's chart points and headline stats from the replayed rating
 * events and ranked rows. Events are assumed chronological (replay order).
 * Returns null when the player has no rated matches or no ranked row —
 * the modal shows an empty state instead.
 */
export function playerHistory(
  events: RatingEvent[],
  rows: RatingRow[],
  playerKey: string,
): PlayerHistory | null {
  const rated = rows.find((r) => r.key === playerKey)
  const mine = events.filter((e) => e.key === playerKey)
  if (!rated || mine.length === 0) return null

  const wins = mine.filter((e) => e.won).length
  const games = mine.length
  const total = rows.length
  return {
    points: [
      { at: null, rating: RATING.R0 },
      ...mine.map((e) => ({ at: e.at, rating: e.ratingAfter })),
    ],
    peak: rated.peak,
    rank: rated.rank,
    total,
    percentile: total === 1 ? 1 : (total - rated.rank) / (total - 1),
    wins,
    losses: games - wins,
    games,
    winRate: wins / games,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "/Users/thibault/Documents/Claude/Projects/Ping Pong Tournament/ping-pong-react" && npx vitest run src/lib/playerHistory.test.ts
```

Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
cd "/Users/thibault/Documents/Claude/Projects/Ping Pong Tournament" && git add ping-pong-react/src/lib/playerHistory.ts ping-pong-react/src/lib/playerHistory.test.ts && git commit -m "feat(rating): playerHistory derivation for the player modal"
```

---

### Task 2: Chart geometry lib

**Files:**
- Create: `ping-pong-react/src/lib/ratingLine.ts`
- Test: `ping-pong-react/src/lib/ratingLine.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (pure numeric helpers).
- Produces (used by Task 3):

```ts
export interface XY { x: number; y: number }
export interface YDomain { min: number; max: number }
export function yDomain(ratings: number[]): YDomain           // padded, min-span guarded
export function gridValues(dom: YDomain): number[]            // 1–4 round gridline values
export function scalePoints(ratings: number[], dom: YDomain, width: number, height: number): XY[]
export function labelIndices(n: number, maxLabels?: number): number[]  // default maxLabels = 4
export function linePath(pts: XY[]): string                   // SVG "M… L…" path
export function areaPath(pts: XY[], height: number): string   // closed fill path
```

- [ ] **Step 1: Write the failing tests**

Create `ping-pong-react/src/lib/ratingLine.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  areaPath,
  gridValues,
  labelIndices,
  linePath,
  scalePoints,
  yDomain,
} from './ratingLine'

describe('yDomain', () => {
  it('pads beyond the data so the line never touches the edges', () => {
    const d = yDomain([1480, 1520])
    expect(d.min).toBeLessThan(1480)
    expect(d.max).toBeGreaterThan(1520)
  })

  it('stays centered on the data', () => {
    const d = yDomain([1480, 1520])
    expect((d.min + d.max) / 2).toBe(1500)
  })

  it('opens a minimum band around a flat history instead of collapsing', () => {
    const d = yDomain([1500, 1500, 1500])
    expect(d.max - d.min).toBeGreaterThanOrEqual(40)
    expect((d.min + d.max) / 2).toBe(1500)
  })
})

describe('gridValues', () => {
  it('returns round values inside the domain', () => {
    const values = gridValues({ min: 1483, max: 1547 })
    expect(values.length).toBeGreaterThanOrEqual(1)
    expect(values.length).toBeLessThanOrEqual(4)
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(1483)
      expect(v).toBeLessThanOrEqual(1547)
      expect(v % 10).toBe(0)
    }
  })

  it('uses a coarser step for a wide domain', () => {
    const values = gridValues({ min: 1200, max: 1800 })
    for (const v of values) expect(v % 200).toBe(0)
  })
})

describe('scalePoints', () => {
  it('spreads points evenly across the width and maps ratings to y (inverted)', () => {
    const pts = scalePoints([1500, 1550, 1600], { min: 1500, max: 1600 }, 100, 50)
    expect(pts).toEqual([
      { x: 0, y: 50 },
      { x: 50, y: 25 },
      { x: 100, y: 0 },
    ])
  })

  it('centers a single point horizontally', () => {
    expect(scalePoints([1500], { min: 1450, max: 1550 }, 100, 50)).toEqual([{ x: 50, y: 25 }])
  })
})

describe('labelIndices', () => {
  it('returns all indices when there are few points', () => {
    expect(labelIndices(3)).toEqual([0, 1, 2])
  })

  it('picks at most maxLabels indices, always including first and last', () => {
    const idx = labelIndices(20)
    expect(idx.length).toBeLessThanOrEqual(4)
    expect(idx[0]).toBe(0)
    expect(idx[idx.length - 1]).toBe(19)
  })
})

describe('paths', () => {
  const pts = [
    { x: 0, y: 50 },
    { x: 50, y: 25 },
    { x: 100, y: 0 },
  ]

  it('builds an SVG line path through every point', () => {
    expect(linePath(pts)).toBe('M0,50 L50,25 L100,0')
  })

  it('closes the area path down to the baseline', () => {
    expect(areaPath(pts, 50)).toBe('M0,50 L50,25 L100,0 L100,50 L0,50 Z')
  })

  it('returns an empty area path for no points', () => {
    expect(areaPath([], 50)).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/thibault/Documents/Claude/Projects/Ping Pong Tournament/ping-pong-react" && npx vitest run src/lib/ratingLine.test.ts
```

Expected: FAIL — `Cannot find module './ratingLine'`.

- [ ] **Step 3: Write the implementation**

Create `ping-pong-react/src/lib/ratingLine.ts`:

```ts
// Pure geometry for the rating-history SVG line chart. No I/O, no React.

export interface XY {
  x: number
  y: number
}

export interface YDomain {
  min: number
  max: number
}

const MIN_SPAN = 40
const PAD = 1.3
const GRID_STEPS = [10, 20, 25, 50, 100, 200, 500]

/** Padded y-domain centered on the data; flat histories get a minimum band. */
export function yDomain(ratings: number[]): YDomain {
  const lo = Math.min(...ratings)
  const hi = Math.max(...ratings)
  const mid = (lo + hi) / 2
  const half = Math.max((hi - lo) / 2, MIN_SPAN / 2) * PAD
  return { min: mid - half, max: mid + half }
}

/** 1–4 round gridline values inside the domain, at the finest step that fits. */
export function gridValues(dom: YDomain): number[] {
  const span = dom.max - dom.min
  const step = GRID_STEPS.find((s) => span / s <= 3) ?? 1000
  const first = Math.ceil(dom.min / step) * step
  const out: number[] = []
  for (let v = first; v <= dom.max; v += step) out.push(v)
  return out
}

/** Even x-spacing, y linear in the domain (SVG y grows downward). */
export function scalePoints(
  ratings: number[],
  dom: YDomain,
  width: number,
  height: number,
): XY[] {
  const n = ratings.length
  return ratings.map((r, i) => ({
    x: n === 1 ? width / 2 : (i / (n - 1)) * width,
    y: height - ((r - dom.min) / (dom.max - dom.min)) * height,
  }))
}

/** Up to `maxLabels` x-label positions, endpoints always included. */
export function labelIndices(n: number, maxLabels = 4): number[] {
  if (n <= maxLabels) return Array.from({ length: n }, (_, i) => i)
  const picked = Array.from({ length: maxLabels }, (_, k) =>
    Math.round((k * (n - 1)) / (maxLabels - 1)),
  )
  return [...new Set(picked)]
}

const fmt = (v: number): string => String(Math.round(v * 10) / 10)

/** SVG path through every point: "M… L… L…". */
export function linePath(pts: XY[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)},${fmt(p.y)}`).join(' ')
}

/** Line path closed down to the baseline, for the gradient fill. */
export function areaPath(pts: XY[], height: number): string {
  if (pts.length === 0) return ''
  const first = pts[0]
  const last = pts[pts.length - 1]
  return `${linePath(pts)} L${fmt(last.x)},${fmt(height)} L${fmt(first.x)},${fmt(height)} Z`
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "/Users/thibault/Documents/Claude/Projects/Ping Pong Tournament/ping-pong-react" && npx vitest run src/lib/ratingLine.test.ts
```

Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
cd "/Users/thibault/Documents/Claude/Projects/Ping Pong Tournament" && git add ping-pong-react/src/lib/ratingLine.ts ping-pong-react/src/lib/ratingLine.test.ts && git commit -m "feat(rating): pure geometry helpers for the rating line chart"
```

---

### Task 3: `RatingLine` SVG component

**Files:**
- Modify: `ping-pong-react/src/components/Charts.tsx` (import at top, component at end)
- Modify: `ping-pong-react/src/index.css` (append at end of file)

**Interfaces:**
- Consumes: everything `ratingLine.ts` produces (Task 2), `PlayerHistoryPoint` shape from Task 1, existing `shortDay(iso)` already defined in `Charts.tsx` (takes `YYYY-MM-DD`).
- Produces (used by Task 4):

```tsx
export interface RatingPoint { at: string | null; rating: number }
export function RatingLine({ points, color }: { points: RatingPoint[]; color: string }): JSX.Element | null
```

- [ ] **Step 1: Add the component**

In `ping-pong-react/src/components/Charts.tsx`, add after the existing imports at the top:

```tsx
import {
  areaPath,
  gridValues,
  labelIndices,
  linePath,
  scalePoints,
  yDomain,
} from '../lib/ratingLine'
```

Then append at the end of the file:

```tsx
export interface RatingPoint {
  at: string | null
  rating: number
}

const ptLabel = (at: string | null): string => (at ? shortDay(at.slice(0, 10)) : '—')

/** Rating-over-time area chart (chess.com style). Pure SVG, themed via CSS vars. */
export function RatingLine({ points, color }: { points: RatingPoint[]; color: string }) {
  if (points.length === 0) return null
  const W = 560
  const H = 180
  const ratings = points.map((p) => p.rating)
  const dom = yDomain(ratings)
  const pts = scalePoints(ratings, dom, W, H)
  const grid = gridValues(dom)
  const labels = labelIndices(points.length)
  return (
    <div className="rl-wrap">
      <svg className="rl-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Évolution de la note">
        <defs>
          <linearGradient id="rl-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {grid.map((v) => {
          const y = H - ((v - dom.min) / (dom.max - dom.min)) * H
          return (
            <g key={v}>
              <line className="rl-grid" x1={0} x2={W} y1={y} y2={y} />
              <text className="rl-yv" x={4} y={y - 4}>
                {v}
              </text>
            </g>
          )
        })}
        {pts.length >= 2 && <path d={areaPath(pts, H)} fill="url(#rl-fill)" />}
        {pts.length >= 2 && <path className="rl-line" d={linePath(pts)} style={{ stroke: color }} />}
        {pts.map((p, i) => (
          <circle
            key={`${points[i].at ?? 'start'}-${i}`}
            className="rl-dot"
            cx={p.x}
            cy={p.y}
            r={pts.length === 1 ? 5 : 3}
            style={{ fill: color }}
          >
            <title>{`${ptLabel(points[i].at)} · ${Math.round(points[i].rating)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="rl-x">
        {labels.map((i) => (
          <span key={i}>{ptLabel(points[i].at)}</span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add the styles**

Append to `ping-pong-react/src/index.css`:

```css
/* ===== rating history chart (player modal) ===== */
.rl-wrap { margin: 4px 0 2px; }
.rl-svg { width: 100%; height: auto; display: block; }
.rl-grid { stroke: var(--border); stroke-width: 1; }
.rl-yv { fill: var(--fg-3); font-size: 10px; }
.rl-line { fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
.rl-dot { stroke: var(--surface); stroke-width: 1; }
.rl-x { display: flex; justify-content: space-between; color: var(--fg-3); font-size: 11px; margin-top: 6px; }
```

- [ ] **Step 3: Typecheck**

```bash
cd "/Users/thibault/Documents/Claude/Projects/Ping Pong Tournament/ping-pong-react" && npx tsc -b
```

Expected: no output (success).

- [ ] **Step 4: Commit**

```bash
cd "/Users/thibault/Documents/Claude/Projects/Ping Pong Tournament" && git add ping-pong-react/src/components/Charts.tsx ping-pong-react/src/index.css && git commit -m "feat(rating): RatingLine SVG chart component"
```

---

### Task 4: `PlayerModal` component

**Files:**
- Create: `ping-pong-react/src/components/PlayerModal.tsx`
- Modify: `ping-pong-react/src/index.css` (append at end of file)

**Interfaces:**
- Consumes: `PlayerHistory` (Task 1), `RatingLine` (Task 3), existing `RatingRow` (from `../hooks/useRatings`), `teamColor`/`teamLabel` (`../lib/teams`), `IconX` (`@tabler/icons-react`), CSS classes `scrim`, `modal pd`, `pd-head`, `pd-kpis`, `pd-kpi`, `rt-prov`, `avatar`, `empty` (all existing).
- Produces (used by Task 5):

```tsx
export default function PlayerModal({ row, history, onClose }: {
  row: RatingRow
  history: PlayerHistory | null
  onClose: () => void
}): JSX.Element
```

- [ ] **Step 1: Write the component**

Create `ping-pong-react/src/components/PlayerModal.tsx`:

```tsx
import { IconX } from '@tabler/icons-react'
import { useEffect } from 'react'
import type { RatingRow } from '../hooks/useRatings'
import type { PlayerHistory } from '../lib/playerHistory'
import { teamColor, teamLabel } from '../lib/teams'
import { RatingLine } from './Charts'

const pct = (v: number): string => `${Math.round(v * 100)} %`

/** "Top N %" from rank/total — clearer in French than a raw percentile. */
const topPct = (rank: number, total: number): string =>
  `Top ${Math.max(1, Math.ceil((rank / total) * 100))} %`

/**
 * Chess.com-style player card: rating trajectory + headline stats.
 * Data comes from the live replay (playerHistory), so it updates in place
 * if a match finishes while the modal is open.
 */
export default function PlayerModal({
  row,
  history,
  onClose,
}: {
  row: RatingRow
  history: PlayerHistory | null
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const color = teamColor(row.team ?? '')
  const initial = (row.name.trim()[0] ?? '?').toUpperCase()

  return (
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal pd rt-pm">
        <button className="pm-close" onClick={onClose} aria-label="Fermer">
          <IconX size={18} stroke={2} />
        </button>

        <div className="pd-head">
          <span className="avatar" style={{ background: `${color}24`, color }}>
            {initial}
          </span>
          <div>
            <h2 style={{ marginBottom: 2 }}>{row.name}</h2>
            <div className="modal-hint" style={{ marginBottom: 0 }}>
              {row.team ? teamLabel(row.team) : '—'}
              {row.provisional && <span className="rt-prov">provisoire</span>}
            </div>
          </div>
          <div className="pm-now">
            <div className="pm-rating">{Math.round(row.rating)}</div>
            <div className="pm-rd">± {Math.round(row.rd)}</div>
          </div>
        </div>

        {history ? (
          <>
            <RatingLine points={history.points} color={color} />
            <div className="pd-kpis pm-kpis">
              <div className="pd-kpi">
                <div className="n">{Math.round(history.peak)}</div>
                <div className="l">Meilleure note</div>
              </div>
              <div className="pd-kpi">
                <div className="n">
                  #{history.rank} / {history.total}
                </div>
                <div className="l">Rang</div>
              </div>
              <div className="pd-kpi">
                <div className="n">{topPct(history.rank, history.total)}</div>
                <div className="l">Percentile</div>
              </div>
              <div className="pd-kpi">
                <div className="n">{history.games}</div>
                <div className="l">Matchs</div>
              </div>
              <div className="pd-kpi">
                <div className="n">
                  {history.wins} · {pct(history.winRate)}
                </div>
                <div className="l">Victoires</div>
              </div>
              <div className="pd-kpi">
                <div className="n">
                  {history.losses} · {pct(1 - history.winRate)}
                </div>
                <div className="l">Défaites</div>
              </div>
            </div>
          </>
        ) : (
          <p className="empty">Aucun match noté pour l'instant.</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add the styles**

Append to `ping-pong-react/src/index.css`:

```css
/* ===== player rating modal ===== */
.rt-pm { position: relative; max-width: 520px; }
.pm-close { position: absolute; top: 14px; right: 14px; background: none; border: 0; color: var(--fg-3); cursor: pointer; padding: 6px; border-radius: 8px; }
.pm-close:hover { color: var(--fg-1); background: var(--surface-hover); }
.pm-now { margin-left: auto; text-align: right; padding-right: 30px; }
.pm-rating { font-family: var(--font-display); font-weight: 700; font-size: 28px; color: var(--fg-1); line-height: 1; }
.pm-rd { color: var(--fg-3); font-size: 12px; margin-top: 3px; }
.pm-kpis { margin-top: 14px; }
```

- [ ] **Step 3: Typecheck**

```bash
cd "/Users/thibault/Documents/Claude/Projects/Ping Pong Tournament/ping-pong-react" && npx tsc -b
```

Expected: no output (success).

- [ ] **Step 4: Commit**

```bash
cd "/Users/thibault/Documents/Claude/Projects/Ping Pong Tournament" && git add ping-pong-react/src/components/PlayerModal.tsx ping-pong-react/src/index.css && git commit -m "feat(rating): PlayerModal with rating chart and headline stats"
```

---

### Task 5: Wire the modal into `Ratings.tsx`

**Files:**
- Modify: `ping-pong-react/src/components/Ratings.tsx`
- Modify: `ping-pong-react/src/index.css` (append at end of file)

**Interfaces:**
- Consumes: `playerHistory` (Task 1), `PlayerModal` (Task 4). `Ratings.tsx` already has `rows`, `events` from `useRatings()` and renders `<tr key={r.key} …>` rows in board mode.

- [ ] **Step 1: Wire the click + modal**

In `ping-pong-react/src/components/Ratings.tsx`:

Add imports (after the existing imports):

```tsx
import { playerHistory } from '../lib/playerHistory'
import PlayerModal from './PlayerModal'
```

Inside the component, next to the existing `const [mode, setMode] = useState<'board' | 'log'>('board')`:

```tsx
const [selectedKey, setSelectedKey] = useState<string | null>(null)
```

Change the board-mode row (currently `<tr key={r.key} className={r.provisional ? '' : `r${r.rank}`}>`) to:

```tsx
<tr
  key={r.key}
  className={`rt-row${r.provisional ? '' : ` r${r.rank}`}`}
  onClick={() => setSelectedKey(r.key)}
>
```

Immediately before the component's final closing `</div>` (the one that closes `<div className="wrap">`, so the modal renders from both board and log modes), add:

```tsx
{(() => {
  const selected = selectedKey ? rows.find((r) => r.key === selectedKey) : undefined
  if (!selected) return null
  return (
    <PlayerModal
      row={selected}
      history={playerHistory(events, rows, selected.key)}
      onClose={() => setSelectedKey(null)}
    />
  )
})()}
```

- [ ] **Step 2: Add the hover affordance**

Append to `ping-pong-react/src/index.css`:

```css
/* clickable classement rows */
.rating-board tbody tr.rt-row { cursor: pointer; }
.rating-board tbody tr.rt-row:hover td { background: var(--surface-hover); }
```

- [ ] **Step 3: Typecheck + full test suite + build**

```bash
cd "/Users/thibault/Documents/Claude/Projects/Ping Pong Tournament/ping-pong-react" && npx tsc -b && npx vitest run && npm run build
```

Expected: all tests pass, build succeeds.

- [ ] **Step 4: Verify in the running app**

```bash
cd "/Users/thibault/Documents/Claude/Projects/Ping Pong Tournament/ping-pong-react" && npm run dev
```

Open the Classement view, click a player row. Verify: modal opens with chart + stats; ✕, backdrop click and Escape all close it; light and dark themes both look right. (Every row has ≥1 rated match by construction — `rankRatings` filters `games > 0` — so the empty state should not appear from the Classement.)

- [ ] **Step 5: Commit**

```bash
cd "/Users/thibault/Documents/Claude/Projects/Ping Pong Tournament" && git add ping-pong-react/src/components/Ratings.tsx ping-pong-react/src/index.css && git commit -m "feat(rating): open player rating history modal from Classement rows"
```

---

### Task 6: Mutation testing on the new lib code

**Files:**
- Create (temporary, deleted before commit): `ping-pong-react/stryker.conf.json`
- Possibly modify: `ping-pong-react/src/lib/playerHistory.test.ts`, `ping-pong-react/src/lib/ratingLine.test.ts` (strengthening tests to kill mutants)

- [ ] **Step 1: Run Stryker scoped to the two new lib files**

Create `ping-pong-react/stryker.conf.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/stryker-mutator/stryker-js/master/packages/api/schema/stryker-core.json",
  "testRunner": "vitest",
  "mutate": ["src/lib/playerHistory.ts", "src/lib/ratingLine.ts"],
  "reporters": ["clear-text", "progress"]
}
```

```bash
cd "/Users/thibault/Documents/Claude/Projects/Ping Pong Tournament/ping-pong-react" && npx --yes --package @stryker-mutator/core --package @stryker-mutator/vitest-runner stryker run
```

Expected: a mutation report listing killed/survived mutants for the two files.

- [ ] **Step 2: Kill surviving mutants**

For each surviving mutant, add or strengthen a test that fails under the mutation (follow the existing style in the two test files). If a mutant's value is genuinely ambiguous (e.g. the exact `PAD` factor or `MIN_SPAN`), ask the human whether pinning it adds value rather than writing a change-detector test. Re-run Stryker until no killable mutants survive.

- [ ] **Step 3: Clean up and commit any strengthened tests**

```bash
cd "/Users/thibault/Documents/Claude/Projects/Ping Pong Tournament/ping-pong-react" && rm -f stryker.conf.json && rm -rf reports .stryker-tmp
cd "/Users/thibault/Documents/Claude/Projects/Ping Pong Tournament" && git add ping-pong-react/src/lib && git commit -m "test(rating): strengthen tests to kill surviving mutants" || echo "nothing to commit"
```

---

## Done criteria

- Clicking any Classement row opens the modal; ✕ / backdrop / Escape close it.
- Chart: 1500 anchor → each rated match, team-colored line + gradient fill, round-value gridlines, ≤4 French date labels, native tooltips per point.
- Stat strips: Meilleure note, Rang #x / y, Top N %, Matchs, Victoires (n, %), Défaites (n, %).
- All French; correct in light and dark; no new dependencies; no schema or query changes.
- `npx tsc -b`, `npx vitest run`, `npm run build` all green; mutation pass done on the two new lib files.
