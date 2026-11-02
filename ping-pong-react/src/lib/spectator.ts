import { serverIsA } from './pingpong'
import { RATING, gameWeight, projectDeltas, type RatingNumbers, type RatingRow } from './rating'
import type { Prediction } from './predictions'
import { sideKey } from './stats'
import { finishedSets, type SetRules } from './sets'
import type { Match, SetScore } from '../types'

export interface CrowdSplit {
  aPercent: number
  bPercent: number
}

export type BoardMatch = Pick<Match, 'id' | 'score_a' | 'score_b' | 'done' | 'started_at'>

/**
 * Whether the spectator shows the live scoreboard rather than the "next up" card.
 * True as soon as the match is genuinely under way — a point scored, an explicit
 * start, or already finished — but also once its reveal timer has fired, so a
 * fresh 0–0 match (which the house always opens with a serve-deciding point) does
 * not sit on the "next up" card waiting for the first tap to sync.
 */
export function showsLiveBoard(match: BoardMatch | null, revealedId: string | null): boolean {
  if (!match) return false
  if (match.done || match.score_a + match.score_b > 0 || !!match.started_at) return true
  return match.id === revealedId
}

type WinnerBet = Pick<Prediction, 'match_id' | 'bet_type' | 'target'>

/**
 * How the crowd's winner bets split between the two players of a match, as
 * integer percentages summing to 100. Null when nobody has picked a winner —
 * the poll bar simply isn't shown then.
 */
export function crowdSplit(
  bets: WinnerBet[],
  match: Pick<Match, 'id' | 'player_a' | 'player_b'>
): CrowdSplit | null {
  const winners = bets.filter((p) => p.match_id === match.id && p.bet_type === 'winner')
  const a = winners.filter((p) => p.target === match.player_a).length
  const b = winners.filter((p) => p.target === match.player_b).length
  if (a + b === 0) return null
  const aPercent = Math.round((a / (a + b)) * 100)
  return { aPercent, bPercent: 100 - aPercent }
}

/**
 * A player's photo from the ladder rows, for the TV avatars. Matched by the
 * same stable identity the rating engine uses (player id, `name:<name>` for
 * legacy matches), with a display-name fallback for surfaces that only know
 * names (the podium). Null = show the monogram.
 */
export function ladderAvatar(
  rows: Pick<RatingRow, 'key' | 'name' | 'avatar_url'>[],
  playerId: string | null,
  name: string
): string | null {
  const row =
    rows.find((r) => r.key === sideKey(playerId, name)) ?? rows.find((r) => r.name === name)
  return row?.avatar_url ?? null
}

export type StakeSide = RatingNumbers

export interface LiveStakesInput {
  match: Pick<Match, 'score_a' | 'score_b' | 'done' | 'match_key' | 'win_to' | 'sets'>
  rules: SetRules
  /** Tie-break for a level score: the serving side is the presumed winner. */
  servingA: boolean
  a: StakeSide | null
  b: StakeSide | null
}

const FRESH: StakeSide = { rating: RATING.R0, rd: RATING.RD0, vol: RATING.VOL0 }

/**
 * Signed "Elo en jeu" per side for a match in progress: the projected rating
 * moves if the leader of the set in play closes it out from here (level score
 * → the server), then wins every set still needed. Null once the match is
 * validated — real deltas take over.
 */
export function liveStakes({
  match,
  rules,
  servingA,
  a,
  b,
}: LiveStakesInput): { a: number; b: number } | null {
  if (match.done) return null
  const { target, bestOf } = rules
  const aLeads = match.score_a === match.score_b ? servingA : match.score_a > match.score_b
  const loserScore = aLeads ? match.score_b : match.score_a
  const winnerScore = Math.max(target, loserScore + 2)
  const asSet = (winner: number, loser: number): SetScore =>
    aLeads ? [winner, loser] : [loser, winner]
  const played = finishedSets(match)
  const setsLeft = (bestOf + 1) / 2 - played.filter(([sa, sb]) => sa > sb === aLeads).length - 1
  const projected = [
    ...played,
    asSet(winnerScore, loserScore),
    ...Array.from({ length: setsLeft }, () => asSet(target, 0)),
  ]
  const [finalA, finalB] = projected[projected.length - 1]
  const weight = gameWeight(
    {
      score_a: finalA,
      score_b: finalB,
      sets: projected.slice(0, -1),
      tournament_id: '',
      match_key: match.match_key,
      win_to: match.win_to,
    },
    { targetByTournament: new Map([['', target]]) }
  )
  const deltas = projectDeltas(a ?? FRESH, b ?? FRESH, aLeads, weight)
  return { a: Math.round(deltas.a), b: Math.round(deltas.b) }
}

type StakesMatch = Pick<
  Match,
  | 'player_a'
  | 'player_a_id'
  | 'player_b'
  | 'player_b_id'
  | 'score_a'
  | 'score_b'
  | 'done'
  | 'serve_start'
  | 'match_key'
  | 'win_to'
  | 'sets'
>

/**
 * "Elo en jeu" for a match, looking each side up on the ladder by the same
 * stable identity the rating engine uses (player id, `name:<name>` fallback).
 */
export function matchStakes(
  rows: RatingRow[],
  match: StakesMatch,
  rules: SetRules
): { a: number; b: number } | null {
  const find = (id: string | null, name: string): StakeSide | null =>
    rows.find((r) => r.key === sideKey(id, name)) ?? null
  return liveStakes({
    match,
    rules,
    servingA: serverIsA(match, rules.target),
    a: find(match.player_a_id, match.player_a),
    b: find(match.player_b_id, match.player_b),
  })
}
