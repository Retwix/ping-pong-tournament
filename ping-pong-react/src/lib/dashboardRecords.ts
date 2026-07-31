import type { Match } from '../types'
import type { RatingEvent } from './rating'
import { isCapot, type PlayerStat } from './stats'

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
