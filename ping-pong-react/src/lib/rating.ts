// Glicko-2 rating engine for the ping-pong ladder.
//
// Design (see docs/elo-rating-system.md):
//  - Per-match updates: both players are recomputed immediately after each game
//    from their current numbers, rather than batched into rating periods.
//  - Margin of victory and match stakes are carried as a single per-game WEIGHT
//    `w` applied to the Glicko-2 variance/improvement terms — a bigger win, or a
//    grand final, moves ratings more (and tightens confidence more) without the
//    gaming incentives that fractional win/loss scores can create.
//  - Rating deviation (RD) decays upward over real elapsed time, so a returning
//    player after a long absence has a looser, faster-moving rating again.
//
// The engine is pure (no I/O) and deterministic: replaying the same matches in
// the same order always yields the same ratings. That mirrors how every other
// stat in the app is derived, and lets ratings be rebuilt from history at will.

import type { Match, Player } from '../types'
import { sideKey } from './stats'

// ---------- tunables (one place) ----------

export const RATING = {
  R0: 1500, // starting rating
  RD0: 350, // starting / maximum rating deviation (uncertainty)
  VOL0: 0.06, // starting volatility
  TAU: 0.5, // system constant: constrains how fast volatility moves
  SCALE: 173.7178, // Glicko-2 internal scale factor

  // Margin of victory → w_margin = 1 + kMargin·(margin/target), clamped.
  kMargin: 0.75,
  marginCap: 1.75,

  // Match stakes → w_stakes.
  wGrandFinal: 1.5,
  wFinal: 1.25,

  // RD decay: per sqrt-day. Inactivity inflates RD back toward RD0 over time.
  // ~18 returns a settled RD (~50) to the 350 default after roughly a year off.
  rdDecayPerDay: 18,

  // A rating is "provisional" until it has settled.
  provisionalGames: 5,
  provisionalRd: 100,
} as const

export type Stakes = 'normal' | 'final' | 'grand_final'

/** Current rating state for one player identity. */
export interface RatingState {
  key: string // stable identity (player id, or `name:<name>`)
  playerId: string | null
  name: string // most recent recorded name
  rating: number
  rd: number
  vol: number
  games: number
  peak: number
  lastPlayedAt: string | null
}

/** One rating change: a player's before/after for a single match. */
export interface RatingEvent {
  matchId: string
  key: string
  playerId: string | null
  name: string
  opponentKey: string
  opponentName: string
  ratingBefore: number
  ratingAfter: number
  rdBefore: number
  rdAfter: number
  delta: number
  weight: number
  stakes: Stakes
  won: boolean
  at: string | null
}

export interface ReplayResult {
  states: Map<string, RatingState>
  events: RatingEvent[]
}

export interface ReplayOptions {
  /** Game target (11/21) per tournament id, for margin normalisation. */
  targetByTournament?: Map<string, number>
}

// ---------- match helpers ----------

function timeKey(m: Match): string {
  return m.ended_at ?? m.started_at ?? ''
}

/** Chronological order, with stable tie-breaks for untimed/legacy matches. */
function chronological(a: Match, b: Match): number {
  const ta = timeKey(a)
  const tb = timeKey(b)
  if (ta !== tb) return ta.localeCompare(tb)
  if (a.tournament_id !== b.tournament_id) return a.tournament_id.localeCompare(b.tournament_id)
  return a.idx - b.idx
}

/** The game target for a match (for margin normalisation). */
function targetFor(m: Match, opts?: ReplayOptions): number {
  const fromMap = opts?.targetByTournament?.get(m.tournament_id)
  if (fromMap) return fromMap
  // Fallback when the tournament target isn't supplied: infer from the score.
  const top = Math.max(m.score_a, m.score_b)
  return top >= 16 ? 21 : 11
}

/** Stakes weight class for a match. GF is decisive; the two matches feeding the
 *  grand final (winners' final, losers' final — both `win_to === 'GF'`) are finals. */
export function stakesOf(m: Match): Stakes {
  if (m.match_key === 'GF') return 'grand_final'
  if (m.win_to === 'GF') return 'final'
  return 'normal'
}

/** Per-game weight: margin × stakes. */
export function gameWeight(m: Match, opts?: ReplayOptions): number {
  const target = targetFor(m, opts)
  const margin = Math.abs(m.score_a - m.score_b)
  const marginRatio = Math.min(1, target > 0 ? margin / target : 0)
  const wMargin = Math.min(RATING.marginCap, 1 + RATING.kMargin * marginRatio)
  const stakes = stakesOf(m)
  const wStakes =
    stakes === 'grand_final' ? RATING.wGrandFinal : stakes === 'final' ? RATING.wFinal : 1
  return wMargin * wStakes
}

// ---------- Glicko-2 math ----------

interface Glicko2 {
  mu: number
  phi: number
  sigma: number
}

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI))
}

function expectedScore(mu: number, oppMu: number, oppPhi: number): number {
  return 1 / (1 + Math.exp(-g(oppPhi) * (mu - oppMu)))
}

/** Solve the new volatility σ' via the Illinois (regula falsi) algorithm. */
function solveVolatility(phi: number, v: number, delta: number, sigma: number): number {
  const tau = RATING.TAU
  const a = Math.log(sigma * sigma)
  const phi2 = phi * phi
  const d2 = delta * delta

  const f = (x: number): number => {
    const ex = Math.exp(x)
    const num = ex * (d2 - phi2 - v - ex)
    const den = 2 * Math.pow(phi2 + v + ex, 2)
    return num / den - (x - a) / (tau * tau)
  }

  let A = a
  let B: number
  if (d2 > phi2 + v) {
    B = Math.log(d2 - phi2 - v)
  } else {
    let k = 1
    while (f(a - k * tau) < 0) k++
    B = a - k * tau
  }

  let fA = f(A)
  let fB = f(B)
  const eps = 1e-6
  let guard = 0
  while (Math.abs(B - A) > eps && guard++ < 100) {
    const C = A + ((A - B) * fA) / (fB - fA)
    const fC = f(C)
    if (fC * fB <= 0) {
      A = B
      fA = fB
    } else {
      fA = fA / 2
    }
    B = C
    fB = fC
  }
  return Math.exp(A / 2)
}

/** Update one player (pre-state) given a single opponent, outcome and weight. */
function updateOne(pre: Glicko2, opp: Glicko2, score: number, weight: number): Glicko2 {
  const gj = g(opp.phi)
  const E = expectedScore(pre.mu, opp.mu, opp.phi)
  const v = 1 / (weight * gj * gj * E * (1 - E))
  const delta = v * weight * gj * (score - E)
  const sigmaPrime = solveVolatility(pre.phi, v, delta, pre.sigma)
  const phiStar = Math.sqrt(pre.phi * pre.phi + sigmaPrime * sigmaPrime)
  const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v)
  const muPrime = pre.mu + phiPrime * phiPrime * weight * gj * (score - E)
  return { mu: muPrime, phi: phiPrime, sigma: sigmaPrime }
}

// ---------- scale conversions ----------

function toGlicko2(rating: number, rd: number, vol: number): Glicko2 {
  return { mu: (rating - RATING.R0) / RATING.SCALE, phi: rd / RATING.SCALE, sigma: vol }
}

function fromGlicko2(s: Glicko2): { rating: number; rd: number; vol: number } {
  return { rating: RATING.R0 + RATING.SCALE * s.mu, rd: RATING.SCALE * s.phi, vol: s.sigma }
}

/** Inflate RD for `days` of inactivity, capped at RD0. */
function decayRd(rd: number, days: number): number {
  if (days <= 0) return rd
  const c2 = RATING.rdDecayPerDay * RATING.rdDecayPerDay
  return Math.min(RATING.RD0, Math.sqrt(rd * rd + c2 * days))
}

function daysBetween(from: string | null, to: string | null): number {
  if (!from || !to) return 0
  const d = (Date.parse(to) - Date.parse(from)) / 86_400_000
  return Number.isFinite(d) && d > 0 ? d : 0
}

// ---------- replay ----------

/**
 * Replay all finished matches in chronological order and produce the current
 * rating state per player plus the ordered list of rating changes.
 */
export function replayRatings(
  matches: Match[],
  players: Player[],
  opts?: ReplayOptions
): ReplayResult {
  const nameById = new Map(players.map((p) => [p.id, p.name]))

  const states = new Map<string, RatingState>()
  const events: RatingEvent[] = []

  const ensure = (id: string | null, recordedName: string): RatingState => {
    const key = sideKey(id, recordedName)
    let s = states.get(key)
    if (!s) {
      s = {
        key,
        playerId: id,
        name: (id && nameById.get(id)) || recordedName,
        rating: RATING.R0,
        rd: RATING.RD0,
        vol: RATING.VOL0,
        games: 0,
        peak: RATING.R0,
        lastPlayedAt: null,
      }
      states.set(key, s)
    } else {
      // Keep the most recent recorded name as the display name.
      s.name = (id && nameById.get(id)) || recordedName
    }
    return s
  }

  const sorted = [...matches].sort(chronological)

  for (const m of sorted) {
    if (m.bye) continue // walkovers aren't real games
    if (m.score_a === m.score_b) continue // no draws in ping-pong

    const A = ensure(m.player_a_id, m.player_a)
    const B = ensure(m.player_b_id, m.player_b)
    const at = m.ended_at ?? m.started_at ?? null

    // Inflate each player's RD for time elapsed since they last played.
    const rdA = decayRd(A.rd, daysBetween(A.lastPlayedAt, at))
    const rdB = decayRd(B.rd, daysBetween(B.lastPlayedAt, at))

    const preA = toGlicko2(A.rating, rdA, A.vol)
    const preB = toGlicko2(B.rating, rdB, B.vol)

    const aWon = m.score_a > m.score_b
    const weight = gameWeight(m, opts)
    const stakes = stakesOf(m)

    const newA = fromGlicko2(updateOne(preA, preB, aWon ? 1 : 0, weight))
    const newB = fromGlicko2(updateOne(preB, preA, aWon ? 0 : 1, weight))

    events.push({
      matchId: m.id,
      key: A.key,
      playerId: A.playerId,
      name: A.name,
      opponentKey: B.key,
      opponentName: B.name,
      ratingBefore: A.rating,
      ratingAfter: newA.rating,
      rdBefore: rdA,
      rdAfter: newA.rd,
      delta: newA.rating - A.rating,
      weight,
      stakes,
      won: aWon,
      at,
    })
    events.push({
      matchId: m.id,
      key: B.key,
      playerId: B.playerId,
      name: B.name,
      opponentKey: A.key,
      opponentName: A.name,
      ratingBefore: B.rating,
      ratingAfter: newB.rating,
      rdBefore: rdB,
      rdAfter: newB.rd,
      delta: newB.rating - B.rating,
      weight,
      stakes,
      won: !aWon,
      at,
    })

    A.rating = newA.rating
    A.rd = newA.rd
    A.vol = newA.vol
    A.games++
    A.peak = Math.max(A.peak, newA.rating)
    A.lastPlayedAt = at

    B.rating = newB.rating
    B.rd = newB.rd
    B.vol = newB.vol
    B.games++
    B.peak = Math.max(B.peak, newB.rating)
    B.lastPlayedAt = at
  }

  return { states, events }
}

export function isProvisional(s: { games: number; rd: number }): boolean {
  return s.games < RATING.provisionalGames || s.rd > RATING.provisionalRd
}

/** A display row for the Classement: rating with confidence band and rank. */
export interface RatingRow extends RatingState {
  rank: number
  provisional: boolean
  team: string | null
  trend: number // signed rating delta of the player's most recent match
}

/**
 * Build the ranked leaderboard rows. Players are ordered by a conservative
 * rating (rating − RD) so an unproven high rating doesn't outrank a settled one.
 */
export function rankRatings(result: ReplayResult, players: Player[]): RatingRow[] {
  const teamById = new Map(players.map((p) => [p.id, p.team]))
  const teamByName = new Map(players.map((p) => [p.name, p.team]))

  // Last event per player drives the trend arrow.
  const lastDelta = new Map<string, number>()
  for (const e of result.events) lastDelta.set(e.key, e.delta)

  const rows = [...result.states.values()]
    .filter((s) => s.games > 0)
    .map((s) => ({
      ...s,
      rank: 0,
      provisional: isProvisional(s),
      team: (s.playerId && teamById.get(s.playerId)) || teamByName.get(s.name) || null,
      trend: lastDelta.get(s.key) ?? 0,
    }))

  // Settled players rank above provisional ones; within each, by conservative rating.
  rows.sort((a, b) => {
    if (a.provisional !== b.provisional) return a.provisional ? 1 : -1
    return b.rating - b.rd - (a.rating - a.rd)
  })
  rows.forEach((r, i) => {
    r.rank = i + 1
  })
  return rows
}
