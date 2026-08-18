// Splits the all-time ladder into the players who hold a rank and les anciens
// (design handoff — Les Anciens). Archiving is a display filter: `rankRatings`
// (rating.ts) stays untouched, so every rating and every active player's
// position in the replay is exactly what it was before the split.

import type { Player, PlayerStatus } from '../types'
import type { RatingRow } from './rating'
import type { Season } from './seasons'

/** An ancien's row, frozen rating plus the departure date the ladder shows instead of a rank. */
export type AncienRow = RatingRow & { leftAt: string | null }

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Whether a player holds a rank in `season` (null season = all-time, where
 * alumni never hold a rank). You rank in a season iff you were still with the
 * company when it closed: a departure on or after the season's closing
 * boundary counts as present for the whole window. A null departure date on
 * an alumnus means "left long ago" — excluded everywhere.
 */
export function ranksInSeason(
  status: PlayerStatus,
  leftAt: string | null,
  season: Season | null,
): boolean {
  if (status === 'active') return true
  if (season === null) return false
  return leftAt !== null && leftAt >= isoDate(season.end)
}

/**
 * Split a ladder into the players who hold a rank and les anciens for the
 * given scope. Pass `season` to apply the season closure rule; omit it (or
 * pass null) for the all-time ladder, where alumni never hold a rank.
 */
export function splitLadder(
  rows: RatingRow[],
  players: Player[],
  season: Season | null = null,
): { ranked: RatingRow[]; anciens: AncienRow[] } {
  const playerById = new Map(players.map((p) => [p.id, p]))
  const playerByName = new Map(players.map((p) => [p.name, p]))
  const playerOf = (r: RatingRow): Player | undefined =>
    (r.playerId ? playerById.get(r.playerId) : undefined) ?? playerByName.get(r.name)

  const ranked: RatingRow[] = []
  const anciens: AncienRow[] = []
  for (const r of rows) {
    const p = playerOf(r)
    const status = p?.status ?? 'active'
    const leftAt = p?.left_at ?? null
    if (ranksInSeason(status, leftAt, season)) ranked.push(r)
    else anciens.push({ ...r, leftAt })
  }

  return {
    ranked: ranked.map((r, i) => ({ ...r, rank: i + 1 })),
    anciens,
  }
}
