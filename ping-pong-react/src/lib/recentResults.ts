import type { Match, Player } from '../types'
import { sideKey, winnerLoser } from './stats'

/** One finished game/match, flattened for the dashboard "Résultats récents" list. */
export interface RecentResult {
  matchId: string
  tournamentId: string
  winner: string
  loser: string
  winnerScore: number
  loserScore: number
  endedAt: string | null
  winnerAvatar: string | null
}

function timeKey(m: Match): string {
  return m.ended_at ?? m.started_at ?? ''
}

/**
 * The most recent finished games across every tournament, newest first. Byes
 * are excluded (they aren't real results). Avatars are matched by the same
 * stable identity the rating engine uses — player id, then a name fallback.
 */
export function recentResults(matches: Match[], players: Player[], limit = 5): RecentResult[] {
  const avatarByKey = new Map<string, string | null>()
  for (const p of players) {
    avatarByKey.set(sideKey(p.id, p.name), p.avatar_url)
    avatarByKey.set(`name:${p.name}`, p.avatar_url)
  }

  return matches
    .filter((m) => m.done && !m.bye)
    .sort((a, b) => timeKey(b).localeCompare(timeKey(a)))
    .slice(0, limit)
    .map((m) => {
      const aWon = m.score_a > m.score_b
      const winnerId = aWon ? m.player_a_id : m.player_b_id
      const { winner, loser, ws, ls } = winnerLoser(m)
      const winnerAvatar =
        avatarByKey.get(sideKey(winnerId, winner)) ?? avatarByKey.get(`name:${winner}`) ?? null
      return {
        matchId: m.id,
        tournamentId: m.tournament_id,
        winner,
        loser,
        winnerScore: ws,
        loserScore: ls,
        endedAt: m.ended_at,
        winnerAvatar,
      }
    })
}
