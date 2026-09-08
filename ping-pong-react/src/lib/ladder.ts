// One ladder = one replay of the matches that feed it. The all-time ladder
// replays everything; a season replays only its own window, so every player's
// first match of the season starts from RATING.R0 — the reset is the absence of
// data, not a rule (docs/superpowers/specs/2026-08-12-seasons-design.md).

import { rankRatings, ratedMatches, replayRatings, type RatingEvent, type RatingRow } from './rating'
import { ALL_TIME, matchesInSeason, seasonOf, type LadderScope } from './seasons'
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

/** null is the lifetime ladder — the scope with no window. */
const scopeOf = (seasonId: string | null): LadderScope =>
  seasonId === null ? ALL_TIME : { kind: 'season', id: seasonId }

/**
 * Every match's rating events, each read off the ladder that match moved: its
 * own season, or the lifetime one for anything played before seasons began — or
 * never dated at all.
 *
 * The same match yields a different delta on each ladder, because a season
 * replays everyone from 1500. Reading a result off the wrong one shows a number
 * that never happened to anybody.
 *
 * One replay per ladder in play, not one per match: each match belongs to
 * exactly one window, so the total work is about a single full replay however
 * many seasons have been played. A match no ladder counts — « non classée », or
 * a double — is absent from the map rather than present and empty.
 */
export function eventsByMatch(data: LadderData): Map<string, RatingEvent[]> {
  const seasonIdOf = new Map<string, string | null>()
  for (const m of data.matches) seasonIdOf.set(m.id, seasonOf(m.ended_at ?? m.started_at))

  const out = new Map<string, RatingEvent[]>()
  for (const seasonId of new Set(seasonIdOf.values())) {
    for (const e of ladderReplay(scopeOf(seasonId), data).events) {
      // A season's replay holds only its own matches, but the lifetime one holds
      // every match — including those a season already answered for.
      if (seasonIdOf.get(e.matchId) !== seasonId) continue
      const found = out.get(e.matchId)
      if (found) found.push(e)
      else out.set(e.matchId, [e])
    }
  }
  return out
}
