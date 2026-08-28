import type { Player } from '../types'
import { fold } from './fold'

/** What Slack tells us about the person signing in, narrowed to what we match a roster row on. */
export interface SlackProfile {
  displayName: string
}

/** Roster names are typed by hand, so compare them past case, accents and stray padding. */
const canonical = (name: string): string => fold(name).trim().replace(/\s+/g, ' ')

/**
 * Either the one roster row this Slack account belongs to, or the roster itself
 * for the person to pick from. A wrong confident match is worse than no match,
 * so anything short of a single hit degrades to the picker.
 */
export type PlayerMatch =
  | { kind: 'matched'; player: Player }
  | { kind: 'choose'; candidates: Player[] }

export function matchPlayer(profile: SlackProfile, players: Player[]): PlayerMatch {
  const unclaimed = players.filter((p) => p.auth_user_id === null)
  const wanted = canonical(profile.displayName)
  const matches = unclaimed.filter((p) => canonical(p.name) === wanted)
  if (matches.length !== 1) return { kind: 'choose', candidates: unclaimed }
  return { kind: 'matched', player: matches[0] }
}
