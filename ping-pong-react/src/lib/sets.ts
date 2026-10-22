// Matches of sets (« Bo3 », « Bo5 ») for quick games — see
// plans/2026-10-21-game-sets.md. A single game is the one-set case, so every
// rule here reduces to today's behaviour when `best_of` is 1 and `sets` is [].

import type { Match, SetScore, Tournament } from '../types'

/** Sets in the match; tournaments created before sets existed are single games. */
export function bestOf(t: Pick<Tournament, 'best_of'>): number {
  return t.best_of ?? 1
}

/** The validated sets before the one in play; none on rows predating sets. */
export function finishedSets(m: Pick<Match, 'sets'>): SetScore[] {
  return m.sets ?? []
}
