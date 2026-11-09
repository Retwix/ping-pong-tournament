import { topProgressions, WEEK_MS, weeklyDelta, winStreak } from './classement'
import { biggestUpsetOf, type DashboardRecords } from './dashboardRecords'
import { individualMatches } from './doubles'
import { relativeTime, signed } from './format'
import { ladderSections } from './inactivity'
import { ladderReplay, scopedEvents, type LadderData } from './ladder'
import type { RatingEvent, RatingRow } from './rating'
import { recentResults, type RecentResult } from './recentResults'
import { currentSeason, daysLeft, defaultLadderScope, type Season } from './seasons'
import { computePlayerStats, computeRivalries, rivalryBalance } from './stats'
import type { Match, Player, Tournament } from '../types'

const RACE_LINES = 5
const FORM_MIN_STREAK = 2
const FORM_STEPS = 5
const RESULT_LINES = 5
const RIVALRY_MIN_GAMES = 5

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
  period: string | null
  beaten: string[]
  risers: FormRiser[]
  upset: DashboardRecords['biggestUpset']
}

export interface FormInput {
  rows: RatingRow[]
  events: RatingEvent[]
  now: Date
}

const within = (span: number, at: string | null, now: Date) =>
  at !== null && new Date(at).getTime() >= now.getTime() - span

const inLastWeek = (at: string | null, now: Date) => within(WEEK_MS, at, now)

const streakPeriod = (lastWin: string | null, now: Date) => {
  if (inLastWeek(lastWin, now)) return 'cette semaine'
  return within(2 * WEEK_MS, lastWin, now) ? 'la semaine dernière' : null
}

/** The hottest run on the ladder; null until someone has won twice in a row. */
export function formScene({ rows, events, now }: FormInput): FormScene | null {
  const [best] = rows
    .map((row) => ({ row, streak: winStreak(events, row.key) }))
    .filter(({ streak }) => streak >= FORM_MIN_STREAK)
    .sort((a, b) => b.streak - a.streak)
  if (!best) return null
  const wins = events.filter((e) => e.key === best.row.key)
  return {
    kind: 'form',
    name: best.row.name,
    streak: best.streak,
    period: streakPeriod(wins[wins.length - 1]?.at ?? null, now),
    beaten: wins.slice(-Math.min(best.streak, FORM_STEPS)).map((e) => e.opponentName),
    risers: topProgressions(events, rows, now).map(({ row, delta7 }) => ({
      name: row.name,
      delta: Math.round(delta7),
    })),
    upset: biggestUpsetOf(events.filter((e) => inLastWeek(e.at, now))),
  }
}

export interface ResultLine {
  winner: string
  loser: string
  score: string
  when: string
  capot: boolean
}

export interface ResultsScene {
  kind: 'results'
  headline: ResultLine
  stamped: boolean
  feed: ResultLine[]
}

export interface ResultsInput {
  matches: Match[]
  players: Player[]
  tournaments: Tournament[]
  now: Date
}

const isCapotResult = ({ sets, doubles }: RecentResult) =>
  !doubles && sets.length === 1 && sets[0][0] > 0 && sets[0][1] === 0

function resultLine(result: RecentResult, now: Date): ResultLine {
  const { winner, loser, sets, endedAt } = result
  const setsWon = sets.filter(([mine, theirs]) => mine > theirs).length
  const ago = relativeTime(endedAt, now)
  return {
    winner,
    loser,
    score: sets.length === 1 ? sets[0].join('–') : `${setsWon}–${sets.length - setsWon}`,
    when: sets.length === 1 ? ago : `${ago} · Bo${2 * setsWon - 1}`,
    capot: isCapotResult(result),
  }
}

const HEADLINE_VARIANTS = 12

/** One variant per recent game, from the last tournament and the last 7 days; a capot gets its stamp. Empty before the first game. */
export function resultsScenes({ matches, players, tournaments, now }: ResultsInput): ResultsScene[] {
  const results = recentResults(matches, players, tournaments, matches.length)
  const [latest] = results
  if (!latest) return []
  const feed = results.slice(0, RESULT_LINES).map((r) => resultLine(r, now))
  return results
    .filter((r) => r === latest || r.tournamentId === latest.tournamentId || inLastWeek(r.endedAt, now))
    .slice(0, HEADLINE_VARIANTS)
    .map((r) => ({ kind: 'results', headline: resultLine(r, now), stamped: isCapotResult(r), feed }))
}

export interface RivalSide {
  name: string
  wins: number
}

export interface RivalryScene {
  kind: 'rivalry'
  total: number
  left: RivalSide
  right: RivalSide
  /** The left player's part of the head-to-head, from 0 to 1. */
  share: number
  records: string[]
}

export interface RivalryInput {
  matches: Match[]
  players: Player[]
  tournaments: Tournament[]
  /** Every event off the ladder it moved, so a record is a number that really happened. */
  events: RatingEvent[]
}

const highest = <T>(items: T[], value: (item: T) => number): T | undefined =>
  [...items].sort((a, b) => value(b) - value(a))[0]

const RIVALRY_VARIANTS = 6
const RECORDS_SHOWN = 3

const rotated = <T>(items: T[], by: number) => [...items.slice(by), ...items.slice(0, by)]

function recordPool(individuals: Match[], players: Player[], events: RatingEvent[]): string[] {
  const stats = computePlayerStats(individuals, players)
  const streak = highest(stats, (s) => s.longestStreak)
  const jump = highest(events, (e) => e.delta)
  const played = highest(stats, (s) => s.played)
  const capots = highest(stats, (s) => s.capotsDealt)
  const saved = highest(stats, (s) => s.matchBallsSaved)
  return [
    ...(streak ? [`${streak.longestStreak} victoires de suite, ${streak.name}`] : []),
    ...(jump ? [`${signed(jump.delta)} en un match, ${jump.name}`] : []),
    ...(played ? [`${played.played} matchs joués, ${played.name}`] : []),
    ...(capots && capots.capotsDealt > 0 ? [`${capots.capotsDealt} capots infligés, ${capots.name}`] : []),
    ...(saved && saved.matchBallsSaved > 0 ? [`${saved.matchBallsSaved} balles de match sauvées, ${saved.name}`] : []),
  ]
}

/** The most played head-to-head, then the closest ones, each with its share of the records; empty below 5 games between two players. */
export function rivalryScenes({ matches, players, tournaments, events }: RivalryInput): RivalryScene[] {
  const individuals = individualMatches(matches, tournaments)
  const rivalries = computeRivalries(individuals, players, RIVALRY_MIN_GAMES)
  const [mostPlayed] = [...rivalries].sort(
    (a, b) => b.total - a.total || rivalryBalance(b) - rivalryBalance(a),
  )
  if (!mostPlayed) return []
  const closest = [...rivalries]
    .filter((r) => r !== mostPlayed)
    .sort((a, b) => rivalryBalance(b) - rivalryBalance(a) || b.total - a.total)
  const pool = recordPool(individuals, players, events)
  return [mostPlayed, ...closest].slice(0, RIVALRY_VARIANTS).map((rivalry, i) => {
    const a = { name: rivalry.aName, wins: rivalry.aWins }
    const b = { name: rivalry.bName, wins: rivalry.bWins }
    const [left, right] = a.wins >= b.wins ? [a, b] : [b, a]
    return {
      kind: 'rivalry',
      total: rivalry.total,
      left,
      right,
      share: left.wins / rivalry.total,
      records: rotated(pool, (i * RECORDS_SHOWN) % Math.max(pool.length, 1)).slice(0, RECORDS_SHOWN),
    }
  })
}

export type TvScene = RaceScene | FormScene | ResultsScene | RivalryScene

const variants = <Scene>(scene: Scene | null): Scene[] => (scene ? [scene] : [])

/** The four scenes in their fixed order, each as the variants it can show; an empty one has nothing to say. */
export function tvScenes(data: LadderData, now: Date): TvScene[][] {
  const season = currentSeason(now)
  const { rows, events } = ladderReplay(defaultLadderScope(now), data)
  const { ranked } = ladderSections({ rows, players: data.players, season, now, archived: false })
  return [
    variants(season && raceScene({ rows: ranked, events, season, now })),
    variants(formScene({ rows: ranked, events, now })),
    resultsScenes({ ...data, now }),
    rivalryScenes({ ...data, events: scopedEvents(data) }),
  ]
}
