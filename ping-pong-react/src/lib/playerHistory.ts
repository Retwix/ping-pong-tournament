import { RATING, type RatingEvent, type RatingRow } from './rating'

/** The match a per-match point was earned in — what the chart tooltip shows. */
export interface PlayerHistoryMatch {
  opponent: string
  scoreFor: number
  scoreAgainst: number
  won: boolean
}

/**
 * One point of a player's rating trajectory (the first has `at: null`).
 * `match` is set on every per-match point; the R0 anchor and the collapsed
 * per-day points have none.
 */
export interface PlayerHistoryPoint {
  at: string | null
  rating: number
  match?: PlayerHistoryMatch
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
 * Collapse a per-match trajectory to one point per day, keeping each day's
 * end-of-day rating (the last match played that day). The leading `at: null`
 * anchor is preserved so the line still starts at R0. Points are assumed
 * chronological, so the last match seen for a day is the end-of-day one.
 * A day point stands for every match played that day, so the single match
 * behind it is dropped rather than shown as if it were the whole day.
 */
export function perDayPoints(points: PlayerHistoryPoint[]): PlayerHistoryPoint[] {
  const byDay = new Map<string, PlayerHistoryPoint>()
  for (const p of points) {
    const day = p.at ? p.at.slice(0, 10) : `anchor:${byDay.size}`
    byDay.set(day, { at: p.at, rating: p.rating })
  }
  return [...byDay.values()]
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
  // Best rating reached *through play* — the free R0 start everyone is handed is
  // deliberately excluded, so a player who only ever declined shows their real
  // high-water mark rather than a meaningless 1500.
  const peak = Math.max(...mine.map((e) => e.ratingAfter))
  return {
    points: [
      { at: null, rating: RATING.R0 },
      ...mine.map((e) => ({
        at: e.at,
        rating: e.ratingAfter,
        match: {
          opponent: e.opponentName,
          scoreFor: e.scoreFor,
          scoreAgainst: e.scoreAgainst,
          won: e.won,
        },
      })),
    ],
    peak,
    rank: rated.rank,
    total,
    percentile: total === 1 ? 1 : (total - rated.rank) / (total - 1),
    wins,
    losses: games - wins,
    games,
    winRate: wins / games,
  }
}
