import type { Player } from '../types'

/** What Slack tells us about the person signing in, narrowed to what we match a roster row on. */
export interface SlackProfile {
  displayName: string | null
}

/**
 * Either the one roster row this Slack account belongs to, or the roster itself
 * for the person to pick from. A wrong confident match is worse than no match,
 * so anything short of a single hit degrades to the picker.
 */
export type PlayerMatch =
  | { kind: 'matched'; player: Player }
  | { kind: 'choose'; candidates: Player[] }

export function matchPlayer(profile: SlackProfile, players: Player[]): PlayerMatch {
  const matches = players.filter((p) => p.name === profile.displayName)
  if (matches.length !== 1) return { kind: 'choose', candidates: players }
  return { kind: 'matched', player: matches[0] }
}
