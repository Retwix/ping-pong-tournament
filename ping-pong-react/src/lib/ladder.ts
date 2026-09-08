// One ladder = one replay of the matches that feed it. The all-time ladder
// replays everything; a season replays only its own window, so every player's
// first match of the season starts from RATING.R0 — the reset is the absence of
// data, not a rule (docs/superpowers/specs/2026-08-12-seasons-design.md).

import { rankRatings, ratedMatches, replayRatings, type RatingEvent, type RatingRow } from './rating'
import { matchesInSeason, type LadderScope } from './seasons'
import type { Match, Player, Tournament } from '../types'

export interface LadderData {
  matches: Match[]
  players: Player[]
  tournaments: Tournament[]
}

export interface Ladder {
  rows: RatingRow[]
  events: RatingEvent[]
}

/** Season window first, then ratedMatches — the order that keeps « non classée » out. */
export function ladderReplay(scope: LadderScope, data: LadderData): Ladder {
  const { matches, players, tournaments } = data
  const targetByTournament = new Map(tournaments.map((t) => [t.id, t.target]))
  const windowed = scope.kind === 'all' ? matches : matchesInSeason(matches, scope.id)
  const result = replayRatings(ratedMatches(windowed, tournaments), players, { targetByTournament })
  return { rows: rankRatings(result, players), events: result.events }
}
