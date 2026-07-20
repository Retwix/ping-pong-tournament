# Player rating history (chess.com-style) — design

2026-07-20 · Status: approved for planning

Clicking a player row in the **Classement** view opens a modal showing that
player's Glicko rating trajectory and headline stats, in the style of a
chess.com stats page: rating-over-time chart, best rating, rank, percentile,
and win/loss record. French UI, consistent with existing design tokens.

## Decisions made during brainstorming

- **Modal, not a profile page.** Opened from the Classement table row. The
  content component is self-contained so it can be promoted to a `/joueur/:id`
  page later without rework.
- **All-time chart only** for v1 — no 30/90-day range selector (the ladder is
  weeks old; ranges would show near-identical charts today).
- **Modal content:** rating chart + stat strip (best rating, rank, percentile)
  + W/L record. No recent-matches list (the Journal already covers match-level
  detail).
- **Chart: `@nivo/line`** (decision revised 2026-07-20 after v1 shipped
  hand-rolled and felt too bare). The hand-rolled SVG was replaced by
  `ResponsiveLine` with crosshair + tooltip (date · rating · ±delta).
  The tested pure logic in `ratingLine.ts` (`yDomain`, `gridValues`,
  `labelIndices`) survives as nivo's scale/tick inputs; the path/scale
  helpers were deleted with the SVG. Theming: nivo's JS theme object is
  built from the CSS variables, refreshed by a `MutationObserver` on
  `data-theme`, so light/dark still follow the app.
- **Data source: the in-memory replay** already exposed by `useRatings()`
  (`events` + `rows`), not the persisted `rating_events` table. Zero new
  queries and no drift: the modal always agrees with the table it opens from.
  The persisted table remains for external consumers (Slack).

## Architecture

Three new units, one edit:

### 1. `src/lib/playerHistory.ts` — pure derivation (tested)

```ts
export interface PlayerHistoryPoint { at: string | null; rating: number }
export interface PlayerHistory {
  points: PlayerHistoryPoint[]   // 1500 anchor first, then ratingAfter per match, chronological
  peak: number                   // max rating ever reached
  rank: number; total: number    // "#3 / 12" from rankRatings rows
  percentile: number             // (total − rank) / (total − 1), 0..1; 1 when total === 1
  wins: number; losses: number; games: number; winRate: number
}
export function playerHistory(
  events: RatingEvent[], rows: RatingRow[], playerKey: string,
): PlayerHistory | null
```

- `points[0]` is the pre-first-match anchor at `RATING.R0` (1500) with
  `at: null`; subsequent points use each event's `ratingAfter` and `at`.
- Player matching uses `RatingEvent.key` === `RatingRow.key` (stable identity:
  player id or `name:<name>`).
- `peak` is read from the player's `RatingRow.peak` (already computed by the
  replay engine) — not recomputed from points.
- Wins/losses counted from the player's events' `won` flags.
- Returns `null` when the player has no rated events — the modal shows an
  empty state ("Aucun match noté pour l'instant").

### 2. `RatingLine` in `src/components/Charts.tsx` — SVG chart

- Area + line, chess.com-style: stroke in the player's `teamColor`,
  translucent gradient fill below, all colors via CSS variables (light/dark
  for free).
- **X axis: match sequence** (evenly spaced), with at most ~4 short French
  date labels (`shortDay`) underneath. Even spacing beats time-proportional
  for bursty office play; dates keep temporal context.
- **Y axis:** 1–4 gridlines at round rating values (multiples of 10),
  auto-scaled to the data with padding — the finest step that yields at most
  4 lines. (Originally "2–3"; no simple round-step algorithm guarantees that
  for every range, so the bound was relaxed by decision on 2026-07-20.)
- Native SVG `<title>` on each point for a cheap hover tooltip
  (date + rating), matching the `title=` pattern in `ActivityChart`.
  A custom hover crosshair is a possible follow-up, not v1.
- 1 data point renders a dot; 2+ renders the line.
- Geometry (point scaling, gridline values, label indices) lives in exported
  pure helpers so it is unit-testable without rendering.

### 3. `src/components/PlayerModal.tsx` — presentation

- `PlayerModal({ row, history, onClose })`: overlay + centered panel.
  Closes on ✕ button, backdrop click, and `Escape`.
- Content, top to bottom:
  - Header: avatar, name, team, « provisoire » badge when applicable,
    current rating large + `± RD` muted.
  - `RatingLine` chart.
  - Stat strip 1: **Meilleure note · Rang #x / y · Percentile** (percentile as
    « Top N % » — top-rank phrasing reads better in French than a raw
    percentile).
  - Stat strip 2: **Matchs · Victoires (n, %) · Défaites (n, %)**.
- All strings French; typography/tokens follow the existing panel styles.

### 4. Edit: `src/components/Ratings.tsx`

- Row click sets `selectedKey`; modal derives its data with
  `playerHistory(events, rows, selectedKey)`. Rows get pointer cursor +
  hover affordance. The row has no competing click targets.
- Realtime: no extra wiring — the modal re-derives from the same live
  `useRatings()` data, so a match finishing while the modal is open updates
  the chart in place.

## Error handling / edge cases

- Player with 0 rated matches → `playerHistory` returns `null` → modal
  renders the empty state instead of the chart/stats.
- Single ranked player → `percentile = 1`, « Rang #1 / 1 ».
- Flat history (all identical ratings) → y-scale pads around the value so the
  line stays centered, no divide-by-zero.
- Events with `at: null` (missing timestamps) → point keeps its sequence
  position; its tooltip/date label shows « — ».

## Testing

TDD throughout (RED-GREEN-MUTATE-KILL-REFACTOR):

- `src/lib/playerHistory.test.ts`: point ordering + 1500 anchor, peak
  (including intermediate peaks), W/L counting, percentile edges (leader,
  last place, single player), `null` for unrated players.
- Chart geometry helper tests: point scaling to viewBox, gridline selection,
  label-index picking, flat-history y-domain.
- Stryker mutation pass on the new lib code; kill surviving mutants.
- Modal open/close interaction stays thin; behavior coverage lives in the
  pure layer (no browser-mode test setup exists in this repo today).

## Out of scope (explicit)

- Time-range selector (30/90 j), recent-matches list in the modal,
  `/joueur/:id` profile page, opponent breakdowns, custom hover crosshair,
  nivo migration. The structure supports all of these as follow-ups.
