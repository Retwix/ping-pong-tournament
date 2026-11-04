import type { Match, Tournament } from '../types'

const IDLE_MS = 10 * 60_000
const FINAL_RESULT_MS = 2 * 60_000

export type TvMode = 'screensaver' | 'live'

export interface TvMoment {
  game: Pick<Tournament, 'created_at' | 'status'> | null
  matches: readonly Pick<Match, 'started_at' | 'ended_at'>[]
  /** When a score last moved on screen: scores carry no timestamp of their own. */
  scoresChangedAt: number | null
  now: number
}

/** Whether the TV shows the screensaver or the live view at this moment. */
export function tvMode({ game, matches, scoresChangedAt, now }: TvMoment): TvMode {
  if (!game) return 'screensaver'
  const stamps = matches.flatMap((m) => [m.started_at, m.ended_at]).filter((at) => at !== null)
  const lastActivity = Math.max(
    Date.parse(game.created_at),
    ...stamps.map(Date.parse),
    scoresChangedAt ?? 0,
  )
  const hold = game.status === 'done' ? FINAL_RESULT_MS : IDLE_MS
  return now - lastActivity < hold ? 'live' : 'screensaver'
}

export interface ScoreWatch {
  scores: string | null
  changedAt: number | null
}

/** Advances the watch over the rows on screen: only a real score change moves `changedAt`. */
export function watchScores(
  watch: ScoreWatch,
  matches: readonly Pick<Match, 'id' | 'score_a' | 'score_b' | 'done'>[],
  now: number,
): ScoreWatch {
  if (matches.length === 0) return watch
  const scores = matches.map((m) => `${m.id}:${m.score_a}-${m.score_b}:${m.done}`).join()
  if (watch.scores === null) return { scores, changedAt: null }
  return scores === watch.scores ? watch : { scores, changedAt: now }
}
