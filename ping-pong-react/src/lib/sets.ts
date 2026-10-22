// Matches of sets (« Bo3 », « Bo5 ») for quick games — see
// plans/2026-10-21-game-sets.md. A single game is the one-set case, so every
// rule here reduces to today's behaviour when `best_of` is 1 and `sets` is [].

import type { Match, MatchSide, SetScore, Tournament } from '../types'
import { isMatchPoint, matchPointKind } from './pingpong'

/** Sets in the match; tournaments created before sets existed are single games. */
export function bestOf(t: Pick<Tournament, 'best_of'>): number {
  return t.best_of ?? 1
}

/** The validated sets before the one in play; none on rows predating sets. */
export function finishedSets(m: Pick<Match, 'sets'>): SetScore[] {
  return m.sets ?? []
}

/** How a match of sets is played: points per set, and sets in the match. */
export interface SetRules {
  target: number
  bestOf: number
}

type LiveScore = Pick<Match, 'score_a' | 'score_b' | 'sets'>

function setsWonBy(m: LiveScore, side: MatchSide): number {
  return finishedSets(m).filter(([a, b]) => (side === 'a' ? a > b : b > a)).length
}

/**
 * What one more point would mean for `side`: winning the whole match
 * ('match'), winning it without conceding a point ('capot', single games only
 * until capots come to sets), winning only the set in play ('set'), or
 * nothing yet (null).
 */
export function pointAtStake(
  m: LiveScore,
  side: MatchSide,
  rules: SetRules,
): 'match' | 'capot' | 'set' | null {
  const [mine, theirs] = side === 'a' ? [m.score_a, m.score_b] : [m.score_b, m.score_a]
  if (rules.bestOf === 1) return matchPointKind(mine, theirs, rules.target)
  if (!isMatchPoint(true, mine, theirs, rules.target)) return null
  const setsToWin = (rules.bestOf + 1) / 2
  return setsWonBy(m, side) + 1 === setsToWin ? 'match' : 'set'
}

/** Whether `side` is one point from winning the whole match — a set ball is not. */
export function isMatchBall(m: LiveScore, side: MatchSide, rules: SetRules): boolean {
  const stake = pointAtStake(m, side, rules)
  return stake === 'match' || stake === 'capot'
}
