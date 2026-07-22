import { serverIsA } from './pingpong'
import { RATING, gameWeight, projectDeltas, type RatingNumbers, type RatingRow } from './rating'
import type { Prediction } from './predictions'
import { sideKey } from './stats'
import type { Match } from '../types'

export interface CrowdSplit {
  aPercent: number
  bPercent: number
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

/** Two-letter avatar monogram: "Léo" → "LÉ", "Jean Marc" → "JM". */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const raw = words.length >= 2 ? words[0][0] + words[1][0] : words[0].slice(0, 2)
  return raw.toUpperCase()
}

export type StakeSide = RatingNumbers

export interface LiveStakesInput {
  match: Pick<Match, 'score_a' | 'score_b' | 'done' | 'match_key' | 'win_to'>
  target: number
  /** Tie-break for a level score: the serving side is the presumed winner. */
  servingA: boolean
  a: StakeSide | null
  b: StakeSide | null
}

const FRESH: StakeSide = { rating: RATING.R0, rd: RATING.RD0, vol: RATING.VOL0 }

/**
 * Signed "Elo en jeu" per side for a match in progress: the projected rating
 * moves if the current leader closes the game out from here (level score → the
 * server). Null once the match is validated — real deltas take over.
 */
export function liveStakes({
  match,
  target,
  servingA,
  a,
  b,
}: LiveStakesInput): { a: number; b: number } | null {
  if (match.done) return null
  const aLeads = match.score_a === match.score_b ? servingA : match.score_a > match.score_b
  const loserScore = aLeads ? match.score_b : match.score_a
  const winnerScore = Math.max(target, loserScore + 2)
  const weight = gameWeight(
    {
      score_a: aLeads ? winnerScore : loserScore,
      score_b: aLeads ? loserScore : winnerScore,
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
>

/**
 * "Elo en jeu" for a match, looking each side up on the ladder by the same
 * stable identity the rating engine uses (player id, `name:<name>` fallback).
 */
export function matchStakes(
  rows: RatingRow[],
  match: StakesMatch,
  target: number
): { a: number; b: number } | null {
  const find = (id: string | null, name: string): StakeSide | null =>
    rows.find((r) => r.key === sideKey(id, name)) ?? null
  return liveStakes({
    match,
    target,
    servingA: serverIsA(match, target),
    a: find(match.player_a_id, match.player_a),
    b: find(match.player_b_id, match.player_b),
  })
}
