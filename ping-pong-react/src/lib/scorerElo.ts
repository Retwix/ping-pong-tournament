import { sideKey } from './stats'
import type { RatingRow } from './rating'
import type { Match } from '../types'

export interface SideElos {
  a: number | null
  b: number | null
}

type MatchSides = Pick<Match, 'player_a' | 'player_a_id' | 'player_b' | 'player_b_id'>

/**
 * Current ladder rating for each side of a match, rounded for display.
 * Sides are matched by the same stable identity the rating engine uses
 * (player id, or `name:<name>` for legacy matches). Null = not ranked yet.
 */
export function sideElos(rows: RatingRow[], match: MatchSides): SideElos {
  const find = (id: string | null, name: string): number | null => {
    const row = rows.find((r) => r.key === sideKey(id, name))
    return row ? Math.round(row.rating) : null
  }
  return {
    a: find(match.player_a_id, match.player_a),
    b: find(match.player_b_id, match.player_b),
  }
}
