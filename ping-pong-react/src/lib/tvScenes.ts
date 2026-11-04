import { topProgressions, WEEK_MS, weeklyDelta, winStreak } from './classement'
import { biggestUpsetOf, type DashboardRecords } from './dashboardRecords'
import type { RatingEvent, RatingRow } from './rating'
import { daysLeft, type Season } from './seasons'

const RACE_LINES = 5
const FORM_MIN_STREAK = 2
const FORM_STEPS = 5

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

export interface FormRiser {
  name: string
  delta: number
}

export interface FormScene {
  kind: 'form'
  name: string
  streak: number
  beaten: string[]
  risers: FormRiser[]
  upset: DashboardRecords['biggestUpset']
}

export interface FormInput {
  rows: RatingRow[]
  events: RatingEvent[]
  now: Date
}

const inLastWeek = (at: string | null, now: Date) =>
  at !== null && new Date(at).getTime() >= now.getTime() - WEEK_MS

/** The hottest run on the ladder; null until someone has won twice in a row. */
export function formScene({ rows, events, now }: FormInput): FormScene | null {
  const [best] = rows
    .map((row) => ({ row, streak: winStreak(events, row.key) }))
    .filter(({ streak }) => streak >= FORM_MIN_STREAK)
    .sort((a, b) => b.streak - a.streak)
  if (!best) return null
  return {
    kind: 'form',
    name: best.row.name,
    streak: best.streak,
    beaten: events
      .filter((e) => e.key === best.row.key)
      .slice(-Math.min(best.streak, FORM_STEPS))
      .map((e) => e.opponentName),
    risers: topProgressions(events, rows, now).map(({ row, delta7 }) => ({
      name: row.name,
      delta: Math.round(delta7),
    })),
    upset: biggestUpsetOf(events.filter((e) => inLastWeek(e.at, now))),
  }
}
