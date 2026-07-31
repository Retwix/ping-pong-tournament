// Pure selectors for the « Les stats » page (/stats).

import type { Match, Tournament } from '../types'
import { relativeTime, signed } from './format'
import { matchDuration } from './pingpong'
import { matchesByDay, opponentRecords, recentMatchesFor, sideKey, type PlayerStat } from './stats'

export type StatsPeriod = 'tout' | 'mois' | 'semaine'
export type StatsType = 'tout' | 'tournois' | 'rapides'

export interface StatsFilters {
  period: StatsPeriod
  type: StatsType
}

export const PERIOD_OPTIONS: ReadonlyArray<{ value: StatsPeriod; label: string }> = [
  { value: 'tout', label: 'Tout' },
  { value: 'mois', label: 'Ce mois-ci' },
  { value: 'semaine', label: 'Cette semaine' },
]

export const TYPE_OPTIONS: ReadonlyArray<{ value: StatsType; label: string }> = [
  { value: 'tout', label: 'Tout' },
  { value: 'tournois', label: 'Tournois' },
  { value: 'rapides', label: 'Parties rapides' },
]

const periodLabel = (p: StatsPeriod): string =>
  PERIOD_OPTIONS.find((o) => o.value === p)?.label ?? p

const typeLabel = (t: StatsType): string => TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t

/** Filters carried in the URL (?p=mois|semaine&t=tournois|rapides) so views deep-link. */
export function parseStatsFilters(search: string): StatsFilters {
  const q = new URLSearchParams(search)
  const p = q.get('p')
  const t = q.get('t')
  return {
    period: p === 'mois' || p === 'semaine' ? p : 'tout',
    type: t === 'tournois' || t === 'rapides' ? t : 'tout',
  }
}

/** The query string for a filter state — only non-defaults are written, '' when unfiltered. */
export function statsSearch(filters: StatsFilters): string {
  const parts: string[] = []
  if (filters.period !== 'tout') parts.push(`p=${filters.period}`)
  if (filters.type !== 'tout') parts.push(`t=${filters.type}`)
  return parts.length === 0 ? '' : `?${parts.join('&')}`
}

const matchTime = (m: Match): string | null => m.ended_at ?? m.started_at

/** Local midnight of the Monday starting the week `now` belongs to. */
function startOfWeek(now: Date): Date {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const backToMonday = (day.getDay() + 6) % 7
  day.setDate(day.getDate() - backToMonday)
  return day
}

function inPeriod(iso: string, period: StatsPeriod, now: Date): boolean {
  const d = new Date(iso)
  if (period === 'mois')
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  const start = startOfWeek(now)
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
  return d >= start && d < end
}

/**
 * The match list every section reads: period is the current calendar month or
 * Monday-start week around `now` (untimed matches only appear on « tout »),
 * type follows the owning tournament's kind (unknown → only on « tout »).
 */
export function scopeMatches(
  matches: Match[],
  tournaments: Tournament[],
  filters: StatsFilters,
  now: Date,
): Match[] {
  const kindById = new Map(tournaments.map((t) => [t.id, t.kind]))
  return matches.filter((m) => {
    if (filters.type !== 'tout') {
      const kind = kindById.get(m.tournament_id)
      const wanted = filters.type === 'tournois' ? 'tournament' : 'game'
      if (kind !== wanted) return false
    }
    if (filters.period !== 'tout') {
      const t = matchTime(m)
      if (t === null || !inPeriod(t, filters.period, now)) return false
    }
    return true
  })
}

export function isFiltered(filters: StatsFilters): boolean {
  return filters.period !== 'tout' || filters.type !== 'tout'
}

/** « Filtré · Ce mois-ci · Tournois » — only the active filters are named. */
export function filterPillLabel(filters: StatsFilters): string {
  const bits: string[] = []
  if (filters.period !== 'tout') bits.push(periodLabel(filters.period))
  if (filters.type !== 'tout') bits.push(typeLabel(filters.type))
  return `Filtré · ${bits.join(' · ')}`
}

/** « 156 matchs · tout · tout » — the scope readout at the right of the filter bar. */
export function scopeLabel(count: number, filters: StatsFilters): string {
  const matches = `${count} ${count >= 2 ? 'matchs' : 'match'}`
  return `${matches} · ${periodLabel(filters.period).toLowerCase()} · ${typeLabel(filters.type).toLowerCase()}`
}

/** Whole minutes, French style: « 45 min » under an hour, « 14 h 32 » beyond. */
export function fmtPlayTime(ms: number): string {
  const mins = Math.round(ms / 60_000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h === 0 ? `${m} min` : `${h} h ${String(m).padStart(2, '0')}`
}

/** Deterministic fr-FR grouping (narrow no-break space) — toLocaleString varies per ICU. */
const fmtInt = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')

const MONTHS_FR = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
]

/** « 2 juin » from a YYYY-MM-DD bucket. */
const dayLabel = (date: string): string => {
  const [, month, day] = date.split('-')
  return `${Number(day)} ${MONTHS_FR[Number(month) - 1]}`
}

export interface ActivityDay {
  date: string
  label: string
  count: number
  /** At 75% of the busiest day or more — drawn in the stronger purple. */
  peak: boolean
}

const ACTIVITY_MAX_DAYS = 30

/** Matches per day for the activity chart — the 30 most recent active days. */
export function activityDays(scoped: Match[]): ActivityDay[] {
  const days = matchesByDay(scoped).slice(-ACTIVITY_MAX_DAYS)
  const max = Math.max(1, ...days.map((d) => d.count))
  return days.map((d) => ({
    date: d.date,
    label: dayLabel(d.date),
    count: d.count,
    peak: d.count >= max * 0.75,
  }))
}

/** « 22 jours d'activité » — the chart's range readout. */
export function chartRangeLabel(days: number): string {
  return `${days} ${days >= 2 ? 'jours' : 'jour'} d'activité`
}

export interface WeekdayCount {
  label: string
  count: number
  /** 0..100, relative to the busiest weekday. */
  pct: number
  top: boolean
}

const WEEKDAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

/**
 * When the office actually plays: Monday–Friday always, weekend rows only if
 * played. Empty when no match carries a timestamp.
 */
export function weekdayProfile(scoped: Match[]): WeekdayCount[] {
  const counts = [0, 0, 0, 0, 0, 0, 0]
  let timed = 0
  for (const m of scoped) {
    const t = matchTime(m)
    if (t === null) continue
    timed++
    counts[(new Date(t).getDay() + 6) % 7]++
  }
  if (timed === 0) return []
  const max = Math.max(1, ...counts)
  return WEEKDAYS_FR.map((label, i) => ({
    label,
    count: counts[i],
    pct: Math.round((counts[i] / max) * 100),
    top: counts[i] === max,
  })).filter((w, i) => i < 5 || w.count > 0)
}

/** « juil. 2026 » from an ISO timestamp. */
const monthYear = (iso: string): string => {
  const d = new Date(iso)
  return `${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
}

export interface PlayerTitles {
  count: number
  titles: Array<{ name: string; date: string }>
}

/**
 * Champions of finished real tournaments, keyed by champion name. The date is
 * the month the tournament ended (its latest match), or its creation month.
 */
export function titlesByName(
  tournaments: Tournament[],
  matches: Match[],
): Map<string, PlayerTitles> {
  const out = new Map<string, PlayerTitles>()
  for (const t of tournaments) {
    if (t.kind !== 'tournament' || t.status !== 'done' || t.champion === null) continue
    let endedAt: string | null = null
    for (const m of matches) {
      if (m.tournament_id !== t.id || m.ended_at === null) continue
      if (endedAt === null || m.ended_at > endedAt) endedAt = m.ended_at
    }
    const entry = out.get(t.champion) ?? { count: 0, titles: [] }
    entry.count++
    entry.titles.push({ name: t.name, date: monthYear(endedAt ?? t.created_at) })
    out.set(t.champion, entry)
  }
  return out
}

export interface LeaderboardRow extends PlayerStat {
  titles: number
}

/** Player stats + title counts (titles are recorded by champion name). */
export function leaderboardRows(
  stats: PlayerStat[],
  titles: Map<string, PlayerTitles>,
): LeaderboardRow[] {
  return stats.map((s) => ({ ...s, titles: titles.get(s.name)?.count ?? 0 }))
}

export type LeaderboardSortKey =
  | 'name'
  | 'played'
  | 'wins'
  | 'losses'
  | 'pct'
  | 'diff'
  | 'streak'
  | 'titles'
  | 'mbSaved'
  | 'mbWasted'

export interface LeaderboardSort {
  key: LeaderboardSortKey
  dir: 'asc' | 'desc'
}

export const DEFAULT_LEADERBOARD_SORT: LeaderboardSort = { key: 'wins', dir: 'desc' }

/** Same column → flip direction; a fresh column → descending (names read A→Z). */
export function toggleSort(sort: LeaderboardSort, key: LeaderboardSortKey): LeaderboardSort {
  if (sort.key === key) return { key, dir: sort.dir === 'desc' ? 'asc' : 'desc' }
  return { key, dir: key === 'name' ? 'asc' : 'desc' }
}

const SORT_VALUE: Record<Exclude<LeaderboardSortKey, 'name'>, (r: LeaderboardRow) => number> = {
  played: (r) => r.played,
  wins: (r) => r.wins,
  losses: (r) => r.losses,
  pct: (r) => r.winRate,
  diff: (r) => r.diff,
  streak: (r) => r.currentStreak,
  titles: (r) => r.titles,
  mbSaved: (r) => r.matchBallsSaved,
  mbWasted: (r) => r.matchBallsWasted,
}

/** Ties break on point diff when sorting by wins, on wins otherwise, then name. */
export function sortLeaderboard(rows: LeaderboardRow[], sort: LeaderboardSort): LeaderboardRow[] {
  const dir = sort.dir === 'asc' ? 1 : -1
  if (sort.key === 'name') return [...rows].sort((a, b) => a.name.localeCompare(b.name, 'fr') * dir)
  const value = SORT_VALUE[sort.key]
  const tie =
    sort.key === 'wins'
      ? (a: LeaderboardRow, b: LeaderboardRow) => b.diff - a.diff
      : (a: LeaderboardRow, b: LeaderboardRow) => b.wins - a.wins
  return [...rows].sort(
    (a, b) => (value(a) - value(b)) * dir || tie(a, b) || a.name.localeCompare(b.name, 'fr'),
  )
}

/** « 🔥 4V » from 2 straight wins, plain « 1V », em-dash when the last match was lost. */
export function streakLabel(streak: number): string {
  if (streak >= 2) return `🔥 ${streak}V`
  return streak === 1 ? '1V' : '—'
}

export interface PlayerCardKpi {
  label: string
  value: string
  tone: 'ink' | 'pos' | 'neg'
}

export interface PlayerCardMatch {
  win: boolean
  opponent: string
  score: string
  date: string
}

export interface OpponentBalance {
  name: string
  record: string
  pct: number
  positive: boolean
}

export interface PlayerCardModel {
  name: string
  team: string | null
  avatarUrl: string | null
  lastSeen: string | null
  kpis: PlayerCardKpi[]
  titles: Array<{ name: string; date: string }>
  nemesis: { name: string; record: string } | null
  victim: { name: string; record: string } | null
  last8: PlayerCardMatch[]
  opponents: OpponentBalance[]
}

/** « 9,8 » — one-decimal French average. */
const fmtAvg = (n: number): string => n.toFixed(1).replace('.', ',')

/** Everything the fiche joueur shows, derived from the scoped stats and matches. */
export function playerCard(
  key: string,
  stats: PlayerStat[],
  titles: Map<string, PlayerTitles>,
  matches: Match[],
  now: Date,
): PlayerCardModel | null {
  const s = stats.find((p) => p.key === key)
  if (s === undefined) return null

  const balances = opponentRecords(key, matches)
    .map((o) => {
      const games = o.wins + o.losses
      const pct = games === 0 ? 0 : Math.round((o.wins / games) * 100)
      return {
        name: o.name,
        record: `${o.wins}-${o.losses}`,
        pct,
        positive: pct >= 50,
        wins: o.wins,
        losses: o.losses,
      }
    })
    .sort((a, b) => b.pct - a.pct || b.wins + b.losses - (a.wins + a.losses))

  const nemesis =
    balances
      .filter((o) => o.losses > 0)
      .sort((a, b) => a.pct - b.pct || b.losses - a.losses)
      .map((o) => ({ name: o.name, record: o.record }))[0] ?? null
  const victim =
    balances
      .filter((o) => o.wins > 0)
      .sort((a, b) => b.pct - a.pct || b.wins - a.wins)
      .map((o) => ({ name: o.name, record: o.record }))[0] ?? null

  const last8 = recentMatchesFor(key, matches, 8).map((m) => {
    const meIsA = sideKey(m.player_a_id, m.player_a) === key
    const my = meIsA ? m.score_a : m.score_b
    const their = meIsA ? m.score_b : m.score_a
    return {
      win: my > their,
      opponent: meIsA ? m.player_b : m.player_a,
      score: `${my}-${their}`,
      date: relativeTime(m.ended_at ?? m.started_at, now),
    }
  })

  const kpis: PlayerCardKpi[] = [
    { label: 'Matchs', value: String(s.played), tone: 'ink' },
    { label: '% victoires', value: `${Math.round(s.winRate * 100)}%`, tone: 'ink' },
    { label: 'V — D', value: `${s.wins} — ${s.losses}`, tone: 'ink' },
    {
      label: 'Diff',
      value: signed(s.diff),
      tone: s.diff > 0 ? 'pos' : s.diff < 0 ? 'neg' : 'ink',
    },
    {
      label: 'Série',
      value: streakLabel(s.currentStreak),
      tone: s.currentStreak > 0 ? 'pos' : 'ink',
    },
    {
      label: 'Meilleure série',
      value: s.longestStreak > 0 ? `${s.longestStreak}V` : '—',
      tone: 'ink',
    },
    {
      label: 'Pts pour / contre',
      value:
        s.played === 0
          ? '—'
          : `${fmtAvg(s.pointsFor / s.played)} / ${fmtAvg(s.pointsAgainst / s.played)}`,
      tone: 'ink',
    },
    {
      label: 'Temps de jeu',
      value: s.timedMatches > 0 ? fmtPlayTime(s.playTimeMs) : '—',
      tone: 'ink',
    },
    {
      label: 'Durée moyenne',
      value: s.timedMatches > 0 ? `${Math.round(s.playTimeMs / s.timedMatches / 60_000)} min` : '—',
      tone: 'ink',
    },
    { label: 'Capots · sous la table', value: `${s.capotsDealt} · ${s.capotsTaken}`, tone: 'ink' },
    { label: 'BM sauvées', value: String(s.matchBallsSaved), tone: 'pos' },
    { label: 'BM gâchées', value: String(s.matchBallsWasted), tone: 'neg' },
  ]

  return {
    name: s.name,
    team: s.team,
    avatarUrl: s.avatar_url,
    lastSeen: s.lastPlayedAt === null ? null : relativeTime(s.lastPlayedAt, now),
    kpis,
    titles: titles.get(s.name)?.titles ?? [],
    nemesis,
    victim,
    last8,
    opponents: balances.map(({ name, record, pct, positive }) => ({ name, record, pct, positive })),
  }
}

export interface StatsKpi {
  label: string
  value: string
  unit: string | null
  sub: string
  /** Green sub line (the unfiltered « +N cette semaine » highlight). */
  accent: boolean
}

/** The 4-card KPI strip. Play time only counts matches with recorded durations. */
export function statsKpis(scoped: Match[], filters: StatsFilters, now: Date): StatsKpi[] {
  const filtered = isFiltered(filters)
  const players = new Set<string>()
  let points = 0
  let timeMs = 0
  let timedCount = 0
  for (const m of scoped) {
    players.add(sideKey(m.player_a_id, m.player_a))
    players.add(sideKey(m.player_b_id, m.player_b))
    points += m.score_a + m.score_b
    if (m.started_at && m.ended_at) {
      const ms = matchDuration(m)
      if (ms > 0) {
        timeMs += ms
        timedCount++
      }
    }
  }
  const weekly = scopeMatches(scoped, [], { period: 'semaine', type: 'tout' }, now).length
  const matchesSub = filtered
    ? 'sur la période filtrée'
    : weekly > 0
      ? `+${weekly} cette semaine`
      : 'aucun match cette semaine'
  const playTime: StatsKpi =
    timedCount === 0
      ? {
          label: 'Temps de jeu',
          value: '—',
          unit: null,
          sub: 'durées non enregistrées',
          accent: false,
        }
      : {
          label: 'Temps de jeu',
          value: fmtPlayTime(timeMs),
          unit: null,
          sub: `≈ ${Math.round(timeMs / timedCount / 60_000)} min par match`,
          accent: false,
        }
  return [
    {
      label: 'Matchs joués',
      value: String(scoped.length),
      unit: null,
      sub: matchesSub,
      accent: !filtered && weekly > 0,
    },
    {
      label: 'Joueurs',
      value: String(players.size),
      unit: null,
      sub: 'ayant joué au moins un match',
      accent: false,
    },
    {
      label: 'Points marqués',
      value: fmtInt(points),
      unit: 'pts',
      sub: 'tous joueurs confondus',
      accent: false,
    },
    playTime,
  ]
}
