// The season calendar. A season is a three-month window anchored on la rentrée,
// derived from a timestamp rather than stored — see
// docs/superpowers/specs/2026-08-12-seasons-design.md.
//
// Boundaries are LOCAL midnight, matching statsPage.ts:startOfWeek. Everyone
// plays in Paris, so local is Paris and DST never enters the arithmetic.

import type { Match } from '../types'
import type { RatingRow } from './rating'

/** Seasons begin here. Anything earlier is « Avant les saisons ». */
export const SEASONS_START = new Date(2026, 8, 1)

export type SeasonSlug = 'automne' | 'hiver' | 'printemps' | 'ete'

export interface Season {
  id: string
  slug: SeasonSlug
  label: string
  /** Inclusive, local midnight. */
  start: Date
  /** Exclusive — the start of the next season. */
  end: Date
  /** The year the season STARTS in: winter 2026 runs Dec 2026 → Feb 2027. */
  year: number
}

const SLUG_BY_MONTH: readonly SeasonSlug[] = [
  'hiver', // Jan — belongs to the winter that started last December
  'hiver', // Feb
  'printemps', // Mar
  'printemps', // Apr
  'printemps', // May
  'ete', // Jun
  'ete', // Jul
  'ete', // Aug
  'automne', // Sep
  'automne', // Oct
  'automne', // Nov
  'hiver', // Dec
]

const SLUGS: readonly SeasonSlug[] = ['automne', 'hiver', 'printemps', 'ete']

const START_MONTH: Record<SeasonSlug, number> = {
  printemps: 2,
  ete: 5,
  automne: 8,
  hiver: 11,
}

const DISPLAY_NAME: Record<SeasonSlug, string> = {
  printemps: 'Printemps',
  ete: 'Été',
  automne: 'Automne',
  hiver: 'Hiver',
}

const isSlug = (v: string): v is SeasonSlug => SLUGS.some((s) => s === v)

function label(slug: SeasonSlug, year: number): string {
  const name = DISPLAY_NAME[slug]
  if (slug !== 'hiver') return `Saison ${name} ${year}`
  // « 2026-27 »: the last two digits of the year the window closes in.
  return `Saison ${name} ${year}-${String(year + 1).slice(-2)}`
}

/** Build a season from its slug and start year. Month overflow rolls the year. */
function makeSeason(slug: SeasonSlug, year: number): Season {
  const month = START_MONTH[slug]
  return {
    id: `${slug}-${year}`,
    slug,
    label: label(slug, year),
    start: new Date(year, month, 1),
    end: new Date(year, month + 3, 1),
    year,
  }
}

/** The season containing `d`, ignoring SEASONS_START. */
function seasonAt(d: Date): Season {
  const month = d.getMonth()
  const slug = SLUG_BY_MONTH[month]
  // Winter is the only season that crosses New Year: its January and February
  // belong to the window that opened the previous December.
  const year =
    slug === 'hiver' && month < START_MONTH.hiver ? d.getFullYear() - 1 : d.getFullYear()
  return makeSeason(slug, year)
}

/**
 * The season id for a match timestamp. null = undated, unparseable, or pre-seasons.
 *
 * The null guard is deliberate rather than load-bearing: `new Date(null)` is the
 * epoch, which the SEASONS_START check would reject anyway. Leaning on that would
 * be leaning on an accident.
 */
export function seasonOf(iso: string | null): string | null {
  if (iso === null) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  if (d < SEASONS_START) return null
  return seasonAt(d).id
}

export function seasonById(id: string): Season | null {
  const dash = id.lastIndexOf('-')
  // Equally deliberate: a dashless id would otherwise be sliced into a prefix that
  // is never a valid slug, so the reject happens either way — just less legibly.
  if (dash < 0) return null
  const slug = id.slice(0, dash)
  const year = Number(id.slice(dash + 1))
  if (!isSlug(slug) || !Number.isInteger(year)) return null
  return makeSeason(slug, year)
}

const DAY_MS = 86_400_000

export function currentSeason(now: Date): Season | null {
  if (now < SEASONS_START) return null
  return seasonAt(now)
}

/** The season that begins the instant this one ends. */
export function nextSeason(s: Season): Season {
  return seasonAt(s.end)
}

/** Started seasons, newest first. */
export function seasonsUpTo(now: Date): Season[] {
  const out: Season[] = []
  let s = seasonAt(SEASONS_START)
  while (s.start <= now) {
    out.push(s)
    s = nextSeason(s)
  }
  return out.reverse()
}

/** Whole days until the window closes. Zero once closed — never negative. */
export function daysLeft(s: Season, now: Date): number {
  return Math.max(0, Math.ceil((s.end.getTime() - now.getTime()) / DAY_MS))
}

export function isClosed(s: Season, now: Date): boolean {
  return now >= s.end
}

/** « 1 septembre → 30 novembre 2026 » — the last day is s.end minus one day. */
export function seasonWindowLabel(s: Season): string {
  const last = new Date(s.end.getTime() - DAY_MS)
  const from = s.start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  const to = last.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  return `${from} → ${to}`
}

/**
 * Same field rating.ts:timeKey sorts by, so season membership matches replay order.
 * Returns null for a match with neither timestamp; the window test below would also
 * exclude it (the epoch predates every season), but not for a reason worth relying on.
 */
const matchTime = (m: Match): string | null => m.ended_at ?? m.started_at

/** The matches played inside a season's window. Undated matches belong to none. */
export function matchesInSeason(matches: Match[], id: string): Match[] {
  const season = seasonById(id)
  if (season === null) return []
  return matches.filter((m) => {
    const t = matchTime(m)
    if (t === null) return false
    const d = new Date(t)
    return d >= season.start && d < season.end
  })
}

/**
 * The champion: the highest-rated player who cleared the provisional gate.
 * `rankRatings` already sorts by rating, so the first eligible row wins.
 * Returns null when nobody qualified — never crown a provisional player.
 */
export function seasonChampion(rows: RatingRow[]): RatingRow | null {
  return rows.find((r) => !r.provisional) ?? null
}

/**
 * Which form the season banner takes. `noleader` and `final` are variants of the
 * running form (different leader line and pill), not separate layouts.
 */
export type SeasonBannerState =
  | 'pre'
  | 'empty'
  | 'noleader'
  | 'final'
  | 'running'
  | 'champion'
  | 'nochamp'

export interface SeasonBannerInput {
  /** null before 1 Sep 2026. */
  season: Season | null
  now: Date
  /**
   * Matches in the window AFTER ratedMatches. A window holding only « non
   * classée » games counts zero here, which is what keeps `leader` non-null below.
   */
  ratedCount: number
  /** Top of the season ladder, eligible or not. null when the ladder is bare. */
  leader: RatingRow | null
}

/** Days remaining at which the countdown switches to its urgent form. */
export const FINAL_DAYS = 7

export function seasonBannerState(input: SeasonBannerInput): SeasonBannerState {
  const { season, now, ratedCount, leader } = input
  if (season === null) return 'pre'
  if (ratedCount === 0 || leader === null) return 'empty'

  if (!isClosed(season, now)) {
    if (leader.provisional) return 'noleader'
    if (daysLeft(season, now) <= FINAL_DAYS) return 'final'
    return 'running'
  }

  return leader.provisional ? 'nochamp' : 'champion'
}
