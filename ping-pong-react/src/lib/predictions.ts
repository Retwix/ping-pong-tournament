import { supabase } from './supabase'
import type { Match, Tournament } from '../types'

// ============================================================
// Predictions (pronostics) — the "no-currency streak" betting model.
//
// People predict outcomes (who wins a match, who wins the tournament, …). There is
// no virtual money: each prediction simply settles to 'won' or 'lost' when the
// underlying match/tournament finishes, and the leaderboard ranks bettors by
// correct calls, accuracy and win streaks. Identity is trust-based — a bettor is
// just whatever name they typed, no auth.
// ============================================================

export type BetType = 'winner' | 'score' | 'capot' | 'champion'
export type PredictionStatus = 'open' | 'won' | 'lost'

export interface Prediction {
  id: string
  created_at: string
  bettor_name: string
  tournament_id: string
  /** null for tournament-level bets (e.g. champion futures). */
  match_id: string | null
  bet_type: BetType
  /** Player name ('winner'/'champion'), score string '11-7' ('score'), or 'yes'/'no' ('capot'). */
  target: string
  status: PredictionStatus
  settled_at: string | null
}

/** Normalise a bettor name so "Léo " and "léo" don't become two people. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/** The winner's display name for a finished match. */
export function matchWinner(m: Match): string {
  return m.score_a > m.score_b ? m.player_a : m.player_b
}

/** Canonical exact-score string for a finished match, e.g. "11-7" (winner first). */
export function matchScoreString(m: Match): string {
  return `${Math.max(m.score_a, m.score_b)}-${Math.min(m.score_a, m.score_b)}`
}

/** A match is a "capot" (shutout) when the loser never scored. */
export function matchIsCapot(m: Match): boolean {
  return m.done && (m.score_a === 0 || m.score_b === 0)
}

/**
 * A match-winner bet is open only before the match has started — i.e. no points
 * scored, never kicked off, not finished. This is the "lock at first point" rule.
 */
export function isMatchBettable(m: Match): boolean {
  return !m.done && !m.started_at && m.score_a === 0 && m.score_b === 0
}

/**
 * Champion futures are open until the tournament has actually begun (any match has
 * a point or has started). After that the field is set, so the bet locks.
 */
export function isChampionBettable(tournament: Tournament, matches: Match[]): boolean {
  if (tournament.status === 'done') return false
  return !matches.some((m) => m.done || m.started_at || m.score_a > 0 || m.score_b > 0)
}

// ---------- reads ----------

/** Every prediction tied to one tournament (match bets + tournament-level bets). */
export async function getTournamentPredictions(tournamentId: string): Promise<Prediction[]> {
  const { data, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('tournament_id', tournamentId)
  if (error) throw error
  return (data ?? []) as Prediction[]
}

/** Every prediction across all tournaments — backs the global leaderboard. */
export async function listAllPredictions(): Promise<Prediction[]> {
  const { data, error } = await supabase.from('predictions').select('*')
  if (error) throw error
  return (data ?? []) as Prediction[]
}

// ---------- placing a bet ----------

export interface PlaceInput {
  bettorName: string
  tournamentId: string
  matchId: string | null
  betType: BetType
  target: string
}

/**
 * Place (or, before lock, change) a prediction. Re-picking the same slot updates the
 * still-open bet rather than creating a duplicate. Throws if the bet already settled.
 */
export async function placePrediction(input: PlaceInput): Promise<void> {
  const bettor_name = normalizeName(input.bettorName)
  if (!bettor_name) throw new Error('Choisis un nom pour parier.')

  // Find any existing bet by this person on the same slot.
  let q = supabase
    .from('predictions')
    .select('id, status')
    .eq('bettor_name', bettor_name)
    .eq('bet_type', input.betType)
  q = input.matchId
    ? q.eq('match_id', input.matchId)
    : q.is('match_id', null).eq('tournament_id', input.tournamentId)

  const { data: existing, error: selErr } = await q.maybeSingle()
  if (selErr) throw selErr

  if (existing) {
    if (existing.status !== 'open') throw new Error('Ce pari est déjà clôturé.')
    const { error } = await supabase
      .from('predictions')
      .update({ target: input.target })
      .eq('id', existing.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('predictions').insert({
    bettor_name,
    tournament_id: input.tournamentId,
    match_id: input.matchId,
    bet_type: input.betType,
    target: input.target,
  })
  if (error) throw error
}

// ---------- settlement ----------

/** Resolve one open prediction against finished match/tournament data. */
function resolveOutcome(
  p: Prediction,
  matchById: Map<string, Match>,
  tournamentById: Map<string, Tournament>
): PredictionStatus | null {
  // Tournament-level bet (champion futures): settle when the tournament is done.
  if (!p.match_id) {
    const t = tournamentById.get(p.tournament_id)
    if (!t || t.status !== 'done' || !t.champion) return null
    return p.target === t.champion ? 'won' : 'lost'
  }

  const m = matchById.get(p.match_id)
  if (!m || !m.done) return null

  switch (p.bet_type) {
    case 'winner':
      return p.target === matchWinner(m) ? 'won' : 'lost'
    case 'score':
      return p.target === matchScoreString(m) ? 'won' : 'lost'
    case 'capot': {
      const predictedYes = p.target === 'yes'
      return predictedYes === matchIsCapot(m) ? 'won' : 'lost'
    }
    default:
      return null
  }
}

/**
 * Reconcile every open prediction whose match/tournament has finished, writing
 * 'won'/'lost'. Idempotent (only touches still-open rows), so it's safe to run from
 * any device or on any page load. Returns how many it settled.
 */
export async function settleOpenPredictions(): Promise<number> {
  const { data: open, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('status', 'open')
  if (error) throw error
  const openBets = (open ?? []) as Prediction[]
  if (!openBets.length) return 0

  const matchIds = [...new Set(openBets.filter((p) => p.match_id).map((p) => p.match_id))]
  const tournamentIds = [...new Set(openBets.map((p) => p.tournament_id))]

  const [matchesRes, tournamentsRes] = await Promise.all([
    matchIds.length
      ? supabase.from('matches').select('*').in('id', matchIds as string[])
      : Promise.resolve({ data: [] as Match[], error: null }),
    supabase.from('tournaments').select('*').in('id', tournamentIds),
  ])
  if (matchesRes.error) throw matchesRes.error
  if (tournamentsRes.error) throw tournamentsRes.error

  const matchById = new Map<string, Match>(
    (matchesRes.data as Match[]).map((m) => [m.id, m])
  )
  const tournamentById = new Map<string, Tournament>(
    (tournamentsRes.data as Tournament[]).map((t) => [t.id, t])
  )

  const won: string[] = []
  const lost: string[] = []
  for (const p of openBets) {
    const outcome = resolveOutcome(p, matchById, tournamentById)
    if (outcome === 'won') won.push(p.id)
    else if (outcome === 'lost') lost.push(p.id)
  }

  const now = new Date().toISOString()
  const writes: Promise<unknown>[] = []
  if (won.length)
    writes.push(
      Promise.resolve(
        supabase.from('predictions').update({ status: 'won', settled_at: now }).in('id', won)
      )
    )
  if (lost.length)
    writes.push(
      Promise.resolve(
        supabase.from('predictions').update({ status: 'lost', settled_at: now }).in('id', lost)
      )
    )
  await Promise.all(writes)
  return won.length + lost.length
}

// ---------- leaderboard ----------

export interface BettorRow {
  name: string
  /** Settled bets (won + lost). */
  total: number
  correct: number
  /** 0..1, over settled bets. */
  accuracy: number
  /** Still-open bets awaiting a result. */
  open: number
  /** Consecutive wins ending at the most recent settled bet. */
  currentStreak: number
  /** Best run of consecutive wins ever. */
  longestStreak: number
}

/** Aggregate predictions into per-bettor leaderboard rows, ranked best-first. */
export function computeLeaderboard(predictions: Prediction[]): BettorRow[] {
  const byName = new Map<string, Prediction[]>()
  for (const p of predictions) {
    const arr = byName.get(p.bettor_name) ?? []
    arr.push(p)
    byName.set(p.bettor_name, arr)
  }

  const rows: BettorRow[] = []
  for (const [name, bets] of byName) {
    const open = bets.filter((b) => b.status === 'open').length
    const settled = bets
      .filter((b) => b.status !== 'open')
      .sort((a, b) => settleTime(a) - settleTime(b))

    let correct = 0
    let longestStreak = 0
    let run = 0
    let currentStreak = 0
    for (const b of settled) {
      if (b.status === 'won') {
        correct++
        run++
        currentStreak++
        if (run > longestStreak) longestStreak = run
      } else {
        run = 0
        currentStreak = 0
      }
    }

    const total = settled.length
    rows.push({
      name,
      total,
      correct,
      accuracy: total ? correct / total : 0,
      open,
      currentStreak,
      longestStreak,
    })
  }

  return rows.sort(
    (a, b) =>
      b.correct - a.correct ||
      b.accuracy - a.accuracy ||
      b.longestStreak - a.longestStreak ||
      a.name.localeCompare(b.name)
  )
}

function settleTime(p: Prediction): number {
  return new Date(p.settled_at ?? p.created_at).getTime()
}
