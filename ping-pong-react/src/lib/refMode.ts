import { isPlayable } from './doubleElim'
import { startPatch } from './pingpong'
import type { Match } from '../types'

export interface RefStartWrite {
  id: string
  patch: Partial<Match>
}

/**
 * The write that puts the referee's current match on the table. Referee mode
 * shows exactly one match at a time and that match *is* the one being played,
 * so it is marked as started on sight — the dashboard and the TV pick it up
 * before the first point, while the chrono still waits for that point.
 *
 * Null when there is nothing to write: no match on screen, already started,
 * already played, or a bracket node still waiting on its players.
 */
export function refStart(
  matches: Match[],
  shownId: string | null,
  now: string,
): RefStartWrite | null {
  const shown = matches.find((match) => match.id === shownId)
  if (!shown || !isPlayable(shown)) return null
  const patch = startPatch(shown, now)
  return patch ? { id: shown.id, patch } : null
}
