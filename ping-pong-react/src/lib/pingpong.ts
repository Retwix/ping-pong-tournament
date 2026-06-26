import type { Match, StandingRow } from '../types'

/** A game is won at >= target points with a 2-point lead. */
export function isWon(a: number, b: number, target: number): boolean {
  return (a >= target || b >= target) && Math.abs(a - b) >= 2
}

/** A match is "live" once it has been started or has at least one point. */
export function isLive(m: Match): boolean {
  return !m.done && (m.score_a + m.score_b > 0 || !!m.started_at)
}

/** Would the given side win with one more point? */
export function isMatchPoint(forA: boolean, a: number, b: number, target: number): boolean {
  if (forA) return isWon(a + 1, b, target) && a >= b
  return isWon(a, b + 1, target) && b >= a
}

/**
 * Whether side A is serving. Serve alternates every 2 points,
 * then every point once both players reach target-1 (deuce).
 */
export function serverIsA(m: Pick<Match, 'score_a' | 'score_b' | 'serve_start'>, target: number): boolean {
  const total = m.score_a + m.score_b
  const deuce = m.score_a >= target - 1 && m.score_b >= target - 1
  const block = deuce ? total : Math.floor(total / 2)
  const startA = m.serve_start === 'a'
  return block % 2 === 0 ? startA : !startA
}

/** Format milliseconds as m:ss. */
export function formatDuration(ms: number | null | undefined): string {
  const s = Math.floor((ms || 0) / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Active duration of a match in ms (live = up to now, finished = start→end). */
export function matchDuration(m: Match, now: number = Date.now()): number {
  if (!m.started_at) return 0
  const start = new Date(m.started_at).getTime()
  const end = m.ended_at ? new Date(m.ended_at).getTime() : now
  return Math.max(0, end - start)
}

/** Compute standings from a set of matches, ranked by wins then point differential. */
export function computeStandings(players: string[], matches: Match[]): StandingRow[] {
  const stats: Record<string, StandingRow> = {}
  for (const p of players) {
    stats[p] = { name: p, played: 0, wins: 0, pointsFor: 0, pointsAgainst: 0, diff: 0 }
  }
  for (const m of matches) {
    if (!m.done || !stats[m.player_a] || !stats[m.player_b]) continue
    stats[m.player_a].played++
    stats[m.player_b].played++
    stats[m.player_a].pointsFor += m.score_a
    stats[m.player_a].pointsAgainst += m.score_b
    stats[m.player_b].pointsFor += m.score_b
    stats[m.player_b].pointsAgainst += m.score_a
    if (m.score_a > m.score_b) stats[m.player_a].wins++
    else stats[m.player_b].wins++
  }
  return Object.values(stats)
    .map((s) => ({ ...s, diff: s.pointsFor - s.pointsAgainst }))
    .sort((x, y) => (y.wins !== x.wins ? y.wins - x.wins : y.diff - x.diff))
}
