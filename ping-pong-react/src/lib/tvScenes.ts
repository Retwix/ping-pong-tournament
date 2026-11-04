import { weeklyDelta } from './classement'
import type { RatingEvent, RatingRow } from './rating'
import { daysLeft, type Season } from './seasons'

const RACE_LINES = 5

export interface RaceLine {
  rank: number
  name: string
  rating: number
  trend: number
}

export interface RaceScene {
  kind: 'race'
  season: string
  daysLeft: number
  leader: string
  chaser: string
  gap: number
  ladder: RaceLine[]
}

export interface RaceInput {
  /** The ladder as Le Classement ranks it: no anciens, no inactifs. */
  rows: RatingRow[]
  events: RatingEvent[]
  season: Season
  now: Date
}

/** The title race; null until two players are out of their provisional games. */
export function raceScene({ rows, events, season, now }: RaceInput): RaceScene | null {
  const [leader, chaser, ...others] = rows.filter((row) => !row.provisional)
  if (!chaser) return null
  return {
    kind: 'race',
    season: season.label,
    daysLeft: daysLeft(season, now),
    leader: leader.name,
    chaser: chaser.name,
    gap: Math.round(leader.rating) - Math.round(chaser.rating),
    ladder: [leader, chaser, ...others].slice(0, RACE_LINES).map((row, i) => ({
      rank: i + 1,
      name: row.name,
      rating: Math.round(row.rating),
      trend: Math.round(weeklyDelta(events, row.key, now)),
    })),
  }
}
