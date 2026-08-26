import type { Match, Tournament } from '../types'
import { relativeTime } from './format'
import type { RatingEvent } from './rating'
import { isCapot, winnerLoser, type PlayerStat } from './stats'

export interface DashboardRecords {
  topStreak: { name: string; avatar_url: string | null; streak: number } | null
  biggestUpset: { winner: string; loser: string; gain: number } | null
  capots: number
  mostActive: { name: string; played: number } | null
}

function topStreakOf(stats: PlayerStat[]): DashboardRecords['topStreak'] {
  const best = [...stats]
    .filter((s) => s.currentStreak >= 2)
    .sort((a, b) => b.currentStreak - a.currentStreak || a.name.localeCompare(b.name))[0]
  return best ? { name: best.name, avatar_url: best.avatar_url, streak: best.currentStreak } : null
}

function mostActiveOf(stats: PlayerStat[]): DashboardRecords['mostActive'] {
  const best = [...stats]
    .filter((s) => s.played > 0)
    .sort((a, b) => b.played - a.played || a.name.localeCompare(b.name))[0]
  return best ? { name: best.name, played: best.played } : null
}

function biggestUpsetOf(events: RatingEvent[]): DashboardRecords['biggestUpset'] {
  const byMatch = new Map<string, RatingEvent[]>()
  for (const e of events) {
    const arr = byMatch.get(e.matchId)
    if (arr) arr.push(e)
    else byMatch.set(e.matchId, [e])
  }
  let best: DashboardRecords['biggestUpset'] = null
  let bestGap = 0
  for (const evs of byMatch.values()) {
    const winner = evs.find((e) => e.won)
    const loser = evs.find((e) => !e.won)
    if (!winner || !loser) continue
    const gap = loser.ratingBefore - winner.ratingBefore
    if (gap > 0 && gap > bestGap) {
      bestGap = gap
      best = { winner: winner.name, loser: loser.name, gain: Math.round(winner.delta) }
    }
  }
  return best
}

/**
 * The flavor stats for the dashboard "Séries & records" card. Each field is
 * independently nullable so the card degrades gracefully when data is thin.
 */
export function dashboardRecords(
  stats: PlayerStat[],
  matches: Match[],
  events: RatingEvent[],
): DashboardRecords {
  return {
    topStreak: topStreakOf(stats),
    biggestUpset: biggestUpsetOf(events),
    capots: matches.filter((m) => m.done && !m.bye && isCapot(m)).length,
    mostActive: mostActiveOf(stats),
  }
}

/** One shutout win, as listed in the dashboard « capots » modal. */
export interface CapotEntry {
  matchId: string
  /** Tournament the match belongs to, so the row can deep-link to its board. */
  tournamentId: string
  winner: string
  loser: string
  /** « 11 – 0 » — the winner's score first. */
  score: string
  /** « Tournoi du vendredi » or « Partie rapide ». */
  context: string
  /** « il y a 2 j », empty when the match carries no timestamp. */
  date: string
}

/** Capot matches, most recent first, with the result and where it happened. */
export function capotList(matches: Match[], tournaments: Tournament[], now: Date): CapotEntry[] {
  const byId = new Map(tournaments.map((t) => [t.id, t]))
  return matches
    .filter((m) => m.done && !m.bye && isCapot(m))
    .sort((a, b) => (b.ended_at ?? '').localeCompare(a.ended_at ?? ''))
    .map((m) => {
      const { winner, loser, ws, ls } = winnerLoser(m)
      const t = byId.get(m.tournament_id)
      return {
        matchId: m.id,
        tournamentId: m.tournament_id,
        winner,
        loser,
        score: `${ws} – ${ls}`,
        context: t === undefined ? '' : t.kind === 'game' ? 'Partie rapide' : t.name,
        date: relativeTime(m.ended_at ?? m.started_at, now),
      }
    })
}
