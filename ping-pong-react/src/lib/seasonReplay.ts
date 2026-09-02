// One ladder per season, each replayed on its own — the shape the app actually
// plays on now that seasons exist.
//
// A season is a hard reset (docs/superpowers/specs/2026-08-12-seasons-design.md):
// it replays only its own matches, from 1500. That makes « the Elo this match
// moved » a per-season question rather than a lifetime one — the +18 on screen
// when the match was validated came from the season's ladder, and a replay of
// all history would show a different number for the same game.
//
// So every surface that reads a past match — Les parties, the tournament board,
// the TV result screen — reads `events` here: each match's move computed inside
// the window it was played in. Matches from before 1 September 2026 keep their
// own bucket rather than losing their deltas.

import { ratedMatches, replayRatings, type RatingEvent, type ReplayResult } from './rating'
import { seasonById, seasonOfMatch } from './seasons'
import type { Match, Player, Tournament } from '../types'

/** The bucket for matches played before the first season (or undated). */
export const PRE_SEASONS = 'pre'

export interface SeasonLadders {
  /** Replay result per season id, plus PRE_SEASONS. Missing = nothing rated played. */
  bySeason: Map<string, ReplayResult>
  /** Every rated match's events, each from the ladder it was played on, oldest first. */
  events: RatingEvent[]
}

/** A season nobody has played a rated match in yet. */
export const EMPTY_LADDER: ReplayResult = { states: new Map(), events: [] }

/** « Avant les saisons » sorts first; every other window by when it opened. */
function startOf(id: string): number {
  return id === PRE_SEASONS ? -Infinity : (seasonById(id)?.start.getTime() ?? -Infinity)
}

/**
 * Replay each season separately. Filtering « non classée » tournaments and
 * doubles once up front is the same set as filtering per window — `ratedMatches`
 * looks at the tournament, never at the date.
 */
export function seasonLadders(
  matches: Match[],
  players: Player[],
  tournaments: Tournament[],
): SeasonLadders {
  const targetByTournament = new Map(tournaments.map((t) => [t.id, t.target]))

  const groups = new Map<string, Match[]>()
  for (const m of ratedMatches(matches, tournaments)) {
    const id = seasonOfMatch(m) ?? PRE_SEASONS
    const group = groups.get(id)
    if (group) group.push(m)
    else groups.set(id, [m])
  }

  const bySeason = new Map<string, ReplayResult>()
  for (const [id, group] of groups) {
    bySeason.set(id, replayRatings(group, players, { targetByTournament }))
  }

  // Chronological over the whole history: windows in calendar order, and
  // `replayRatings` already orders the matches inside each one.
  const events = [...bySeason.keys()]
    .sort((a, b) => startOf(a) - startOf(b))
    .flatMap((id) => bySeason.get(id)?.events ?? [])

  return { bySeason, events }
}

/** One season's ladder — empty, not absent, when the window holds no rated match. */
export function ladderOf(ladders: SeasonLadders, id: string): ReplayResult {
  return ladders.bySeason.get(id) ?? EMPTY_LADDER
}
