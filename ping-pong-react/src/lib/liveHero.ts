import type { Match } from '../types'

/** A match is "live" once it has been started or has at least one point. */
export function isLive(m: Match): boolean {
  return !m.done && (m.score_a + m.score_b > 0 || !!m.started_at)
}

/** The match the dashboard hero should feature: the one in progress, else null. */
export function pickLiveMatch(matches: Match[]): Match | null {
  return matches.find(isLive) ?? null
}
