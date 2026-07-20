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
