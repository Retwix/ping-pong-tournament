// Matches of sets (« Bo3 », « Bo5 ») for quick games — see
// plans/2026-10-21-game-sets.md. A single game is the one-set case, so every
// rule here reduces to today's behaviour when `best_of` is 1 and `sets` is [].

import type { Match, MatchSide, SetScore, Tournament } from '../types'
import { isMatchPoint, isWon, matchPointKind } from './pingpong'

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
  return setDecidesMatch(m, side, rules) ? 'match' : 'set'
}

/** Would winning the set in play give `side` the majority of the sets? */
function setDecidesMatch(m: LiveScore, side: MatchSide, rules: SetRules): boolean {
  const setsToWin = (rules.bestOf + 1) / 2
  return setsWonBy(m, side) + 1 === setsToWin
}

/** Whether `side` is one point from winning the whole match — a set ball is not. */
export function isMatchBall(m: LiveScore, side: MatchSide, rules: SetRules): boolean {
  const stake = pointAtStake(m, side, rules)
  return stake === 'match' || stake === 'capot'
}

/** Whether the set in play is won, and winning it takes the match. */
export function wonSetDecidesMatch(m: LiveScore, rules: SetRules): boolean {
  if (!isWon(m.score_a, m.score_b, rules.target)) return false
  return setDecidesMatch(m, m.score_a > m.score_b ? 'a' : 'b', rules)
}

/**
 * « Valider le set »: a won set either ends the match (the deciding set stays
 * in `score_a/score_b`) or joins `sets` and the next one starts at 0-0. The
 * whole array is written, so two devices validating the same set agree.
 * Null when the set in play isn't won, or the match is already over.
 */
export function validateSetPatch(
  m: LiveScore & Pick<Match, 'done'>,
  rules: SetRules,
  at: string,
): Partial<Match> | null {
  if (m.done || !isWon(m.score_a, m.score_b, rules.target)) return null
  if (wonSetDecidesMatch(m, rules)) return { done: true, ended_at: at }
  return { sets: [...finishedSets(m), [m.score_a, m.score_b]], score_a: 0, score_b: 0 }
}

/**
 * « Annuler » right after « Valider le set »: while the new set is still 0-0,
 * the last validated set comes back into play, unvalidated, so « −1 point »
 * can correct it. Read from the stored sets, so it survives a reload. Null
 * once a point has been scored in the new set — the last set is then locked.
 */
export function undoSetValidationPatch(m: LiveScore): Partial<Match> | null {
  const sets = finishedSets(m)
  const last = sets[sets.length - 1]
  if (!last || m.score_a + m.score_b > 0) return null
  return { sets: sets.slice(0, -1), score_a: last[0], score_b: last[1] }
}
