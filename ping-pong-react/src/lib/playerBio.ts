import type { Match, Player } from '../types'

export const BIO_MAX_LENGTH = 20

export interface SideBios {
  a: string | null
  b: string | null
}

type MatchSides = Pick<Match, 'player_a' | 'player_a_id' | 'player_b' | 'player_b_id'>

/**
 * A player's bio, read from the registry rather than the ladder: the ladder
 * leaves out anyone without a rated match, and a first game should still show
 * it. A side with an id is that player and no other, so a rename or a namesake
 * can't move a bio; only a legacy side falls back to its name.
 */
export function playerBio(players: Player[], id: string | null, name: string): string | null {
  const found = players.find((p) => (id === null ? p.name === name : p.id === id))
  return found?.bio ?? null
}

export function sideBios(players: Player[], match: MatchSides): SideBios {
  return {
    a: playerBio(players, match.player_a_id, match.player_a),
    b: playerBio(players, match.player_b_id, match.player_b),
  }
}

export function cleanBio(typed: string): string | null {
  return typed.trim() || null
}
