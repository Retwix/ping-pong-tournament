import type { Tournament } from '../types'

const IDLE_MS = 10 * 60_000

export type TvMode = 'screensaver' | 'live'

export interface TvMoment {
  game: Pick<Tournament, 'created_at' | 'status'> | null
  now: number
}

/** Whether the TV shows the screensaver or the live view at this moment. */
export function tvMode({ game, now }: TvMoment): TvMode {
  if (!game) return 'screensaver'
  return now - Date.parse(game.created_at) < IDLE_MS ? 'live' : 'screensaver'
}
