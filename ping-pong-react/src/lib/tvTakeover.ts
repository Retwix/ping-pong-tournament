import type { Match, Tournament } from '../types'

const IDLE_MS = 10 * 60_000

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
  return now - lastActivity < IDLE_MS ? 'live' : 'screensaver'
}
