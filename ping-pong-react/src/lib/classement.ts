// Pure selectors for the Classement Elo page. All derive display data from the
// rating rows/events produced by the Glicko-2 replay (see rating.ts).

import type { RatingEvent, RatingRow } from './rating'

// Events arrive in replay order (oldest first) — the same order the rating
// engine consumed them — so "most recent" is the tail of the array.
const eventsOf = (events: RatingEvent[], key: string) => events.filter((e) => e.key === key)

export interface PlayerRecord {
  wins: number
  losses: number
}

/** Lifetime win–loss record of one player. */
export function recordOf(events: RatingEvent[], key: string): PlayerRecord {
  const mine = eventsOf(events, key)
  const wins = mine.filter((e) => e.won).length
  return { wins, losses: mine.length - wins }
}

/** The player's last ≤5 results as won flags, most recent last (the form dots). */
export function lastFive(events: RatingEvent[], key: string): boolean[] {
  return eventsOf(events, key)
    .slice(-5)
    .map((e) => e.won)
}

/** Current run of consecutive wins, counted backward from the most recent match. */
export function winStreak(events: RatingEvent[], key: string): number {
  const mine = eventsOf(events, key)
  let streak = 0
  for (let i = mine.length - 1; i >= 0 && mine[i].won; i--) streak++
  return streak
}

/** The « N victoires » badge appears from this many consecutive wins. */
export const STREAK_BADGE_MIN = 3

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Signed rating change over the trailing seven days (the « 7 J » column). */
export function weeklyDelta(events: RatingEvent[], key: string, now: Date): number {
  const cutoff = now.getTime() - WEEK_MS
  return eventsOf(events, key)
    .filter((e) => e.at !== null && new Date(e.at).getTime() >= cutoff)
    .reduce((sum, e) => sum + e.delta, 0)
}

export interface PodiumEntry {
  row: RatingRow
  record: PlayerRecord
  delta7: number
  note: string | null
}

export interface Podium {
  first: PodiumEntry
  second: PodiumEntry
  third: PodiumEntry
}

/**
 * The top three non-provisional players, with the display notes of the design:
 * the runner-up gets its gap to the title, the third its win streak when on a
 * run (gap otherwise). Null while fewer than three players are ranked — the
 * podium section simply doesn't render then.
 */
export function podium(rows: RatingRow[], events: RatingEvent[], now: Date): Podium | null {
  const ranked = rows.filter((r) => !r.provisional)
  if (ranked.length < 3) return null
  const [first, second, third] = ranked

  const entry = (row: RatingRow, note: string | null): PodiumEntry => ({
    row,
    record: recordOf(events, row.key),
    delta7: weeklyDelta(events, row.key, now),
    note,
  })
  const gapNote = (row: RatingRow) => {
    const { wins, losses } = recordOf(events, row.key)
    const gap = Math.round(first.rating) - Math.round(row.rating)
    return `${wins}–${losses} · à ${gap} points du titre`
  }
  const streakNote = (row: RatingRow) => {
    const streak = winStreak(events, row.key)
    if (streak < 2) return gapNote(row)
    const { wins, losses } = recordOf(events, row.key)
    return `${wins}–${losses} · ${streak} victoires d'affilée`
  }

  return {
    first: entry(first, null),
    second: entry(second, gapNote(second)),
    third: entry(third, streakNote(third)),
  }
}

export interface RatingGap {
  above: RatingRow
  below: RatingRow
  gap: number
}

/**
 * The three smallest gaps between ranked neighbours, tightest first — the
 * places that can flip on the next match. Gaps use displayed (rounded) values
 * so the pill never contradicts the table.
 */
export function tightestGaps(rows: RatingRow[]): RatingGap[] {
  const ranked = rows.filter((r) => !r.provisional)
  const gaps = ranked.slice(1).map((below, i) => ({
    above: ranked[i],
    below,
    gap: Math.round(ranked[i].rating) - Math.round(below.rating),
  }))
  return gaps.sort((a, b) => a.gap - b.gap).slice(0, 3)
}

export interface Progression {
  row: RatingRow
  delta7: number
}

/** The three ranked players who gained the most points over the trailing week. */
export function topProgressions(
  events: RatingEvent[],
  rows: RatingRow[],
  now: Date,
): Progression[] {
  return rows
    .filter((r) => !r.provisional)
    .map((row) => ({ row, delta7: weeklyDelta(events, row.key, now) }))
    .filter((p) => p.delta7 > 0)
    .sort((a, b) => b.delta7 - a.delta7)
    .slice(0, 3)
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Case- and accent-insensitive search over player names and teams. Empty query → all rows. */
export function filterRatingRows(rows: RatingRow[], query: string): RatingRow[] {
  const q = fold(query.trim())
  return rows.filter(
    (r) => fold(r.name).includes(q) || (r.team !== null && fold(r.team).includes(q)),
  )
}

/** ISO timestamp of the most recently rated match, or null when nothing is rated yet. */
export function lastRatedAt(events: RatingEvent[]): string | null {
  let latest: string | null = null
  for (const e of events) {
    if (e.at === null) continue
    if (latest === null || new Date(e.at).getTime() > new Date(latest).getTime()) latest = e.at
  }
  return latest
}
