// Pure selectors for the Classement Elo page. All derive display data from the
// rating rows/events produced by the Glicko-2 replay (see rating.ts).

import type { RatingEvent } from './rating'

/** ISO timestamp of the most recently rated match, or null when nothing is rated yet. */
export function lastRatedAt(events: RatingEvent[]): string | null {
  let latest: string | null = null
  for (const e of events) {
    if (e.at === null) continue
    if (latest === null || new Date(e.at).getTime() > new Date(latest).getTime()) latest = e.at
  }
  return latest
}
