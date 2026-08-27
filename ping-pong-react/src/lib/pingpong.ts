import type { Match, MatchSide, StandingRow } from '../types'

/**
 * Score patch removing one point from the given side (referee correction),
 * or null when there is nothing to remove: side already at 0, or match
 * already validated. Unlike adding a point, this stays available on a
 * winning-but-unvalidated score — that accidental extra tap is the whole
 * reason the correction exists.
 */
export function decrementPatch(
  m: Pick<Match, 'score_a' | 'score_b' | 'done'>,
  side: MatchSide
): Partial<Match> | null {
  if (m.done) return null
  const score = side === 'a' ? m.score_a : m.score_b
  if (score <= 0) return null
  return side === 'a' ? { score_a: score - 1 } : { score_b: score - 1 }
}

/** A game is won at >= target points with a 2-point lead. */
export function isWon(a: number, b: number, target: number): boolean {
  return (a >= target || b >= target) && Math.abs(a - b) >= 2
}

/** Would the given side win with one more point? */
export function isMatchPoint(forA: boolean, a: number, b: number, target: number): boolean {
  if (forA) return isWon(a + 1, b, target) && a >= b
  return isWon(a, b + 1, target) && b >= a
}

/**
 * What one more point would mean for the side at `myScore`: winning the game
 * ('match'), winning it without conceding a single point ('capot'), or nothing
 * yet (null). Null once the game is already over.
 */
export function matchPointKind(
  myScore: number,
  oppScore: number,
  target: number
): 'match' | 'capot' | null {
  if (isWon(myScore, oppScore, target)) return null
  if (!isMatchPoint(true, myScore, oppScore, target)) return null
  return oppScore === 0 ? 'capot' : 'match'
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

type Chrono = Pick<Match, 'started_at' | 'first_point_at' | 'score_a' | 'score_b'>

/**
 * When the clock started, or null while it has not. A match is started (put on
 * the table) before it is played, so the chrono is the first point — never
 * `started_at`, which is the referee opening it.
 *
 * Rows written before `first_point_at` existed stamped `started_at` on the
 * first point, so they fall back to it. The score guard tells the two apart: a
 * match sitting on the table at 0–0 has no chrono at all.
 */
export function chronoStart(m: Chrono): string | null {
  if (m.first_point_at) return m.first_point_at
  return m.score_a + m.score_b > 0 ? m.started_at : null
}

/** Active duration of a match in ms (live = up to now, finished = start→end). */
export function matchDuration(
  m: Chrono & Pick<Match, 'ended_at'>,
  now: number = Date.now(),
): number {
  const chrono = chronoStart(m)
  if (!chrono) return 0
  const start = new Date(chrono).getTime()
  const end = m.ended_at ? new Date(m.ended_at).getTime() : now
  return Math.max(0, end - start)
}

/**
 * Puts a match on the table: it reads as live everywhere (dashboard, TV, board)
 * from that moment, while the chrono waits for the first point. Null when there
 * is nothing to write — already started, or already played.
 */
export function startPatch(
  m: Pick<Match, 'done' | 'started_at'>,
  now: string,
): Partial<Match> | null {
  if (m.done || m.started_at) return null
  return { started_at: now }
}

/**
 * The timestamps a scored point adds. The first point starts the chrono, and
 * starts the match itself when it was never opened in referee mode. Empty once
 * the match is under way — the chrono never moves.
 */
export function firstPointPatch(m: Chrono, now: string): Partial<Match> {
  if (m.score_a + m.score_b > 0 || m.first_point_at) return {}
  return m.started_at ? { first_point_at: now } : { started_at: now, first_point_at: now }
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
