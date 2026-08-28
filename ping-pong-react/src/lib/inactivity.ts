// Splits a ranked ladder into the players who still hold a rank and those who
// have gone quiet. Like `splitLadder` (alumni.ts) this is a display filter:
// `rating.ts` is untouched, so every rating, RD and replay position is exactly
// what it was before the split. `now` is injected so the rule is testable.

import type { Player } from '../types'
import { splitLadder, type AncienRow } from './alumni'
import type { RatingRow } from './rating'
import type { Season } from './seasons'

export const INACTIVITY = { days: 30 }

/** An inactive player's row: the frozen rating plus how long they have been away. */
export type InactifRow = RatingRow & { daysIdle: number }

/** Whole days since the last rated match. A null `lastPlayedAt` counts as 0 — fail open. */
function daysIdle(lastPlayedAt: string | null, now: Date): number {
  if (!lastPlayedAt) return 0
  return Math.floor((now.getTime() - Date.parse(lastPlayedAt)) / 86_400_000)
}

/**
 * Split a ranked ladder into the players who still hold a rank and les
 * inactifs. `rows` must arrive in rating order, as `rankRatings` emits it:
 * both halves inherit it — les inactifs are listed in it, and the survivors
 * are renumbered from their position in it.
 */
export function splitInactive(
  rows: RatingRow[],
  now: Date,
): { active: RatingRow[]; inactifs: InactifRow[] } {
  const active: RatingRow[] = []
  const inactifs: InactifRow[] = []
  for (const r of rows) {
    const idle = daysIdle(r.lastPlayedAt, now)
    if (idle >= INACTIVITY.days) inactifs.push({ ...r, daysIdle: idle })
    else active.push(r)
  }
  return {
    active: active.map((r, i) => ({ ...r, rank: i + 1 })),
    inactifs,
  }
}

export type LadderSectionsInput = {
  rows: RatingRow[]
  players: Player[]
  season: Season | null
  now: Date
  /** A closed season is frozen history: everyone in it is trivially idle, so the rule is off. */
  archived: boolean
}

/**
 * The three blocks Le Classement renders, in one place so the component holds
 * no logic: the numbered ladder, les anciens, and les inactifs.
 */
export function ladderSections({ rows, players, season }: LadderSectionsInput): {
  ranked: RatingRow[]
  anciens: AncienRow[]
  inactifs: InactifRow[]
} {
  const { ranked, anciens } = splitLadder(rows, players, season)
  return { ranked, anciens, inactifs: [] }
}
