// Pure selectors for the « Les stats » page (/stats).

import type { Match, Tournament } from '../types'
import { individualMatches } from './doubles'
import { relativeTime, signed } from './format'
import { matchDuration } from './pingpong'
import { stakesOf } from './rating'
import { fold } from './fold'
import {
  computeSuperlatives,
  matchesByDay,
  opponentRecords,
  recentMatchesFor,
  sideKey,
  winnerLoser,
  type PlayerStat,
  type Rivalry,
} from './stats'
import { currentSeason } from './seasons'

export type StatsPeriod = 'tout' | 'saison' | 'mois' | 'semaine'
export type StatsType = 'tout' | 'tournois' | 'rapides'

export interface StatsFilters {
  period: StatsPeriod
  type: StatsType
}

export const PERIOD_OPTIONS: ReadonlyArray<{ value: StatsPeriod; label: string }> = [
  { value: 'tout', label: 'Tout' },
  { value: 'saison', label: 'Cette saison' },
  { value: 'mois', label: 'Ce mois-ci' },
  { value: 'semaine', label: 'Cette semaine' },
]

export const TYPE_OPTIONS: ReadonlyArray<{ value: StatsType; label: string }> = [
  { value: 'tout', label: 'Tout' },
  { value: 'tournois', label: 'Tournois' },
  { value: 'rapides', label: 'Parties rapides' },
]

/**
 * Whether a period can be chosen right now. « Cette saison » is shown before
 * 1 September but not selectable: hiding it made people ask for a filter that
 * already existed, and a greyed chip answers the question the absent one raised.
 */
export function isPeriodAvailable(period: StatsPeriod, now: Date): boolean {
  return period !== 'saison' || currentSeason(now) !== null
}

const periodLabel = (p: StatsPeriod): string =>
  PERIOD_OPTIONS.find((o) => o.value === p)?.label ?? p

const typeLabel = (t: StatsType): string => TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t

/** Filters carried in the URL (?p=mois|semaine&t=tournois|rapides) so views deep-link. */
export function parseStatsFilters(search: string): StatsFilters {
  const q = new URLSearchParams(search)
  const p = q.get('p')
  const t = q.get('t')
  return {
    period: p === 'saison' || p === 'mois' || p === 'semaine' ? p : 'tout',
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
  // The season window, never a rolling ninety days: « cette saison » has to mean
  // the same three months everyone else's ladder is scored over.
  if (period === 'saison') {
    const s = currentSeason(now)
    return s !== null && d >= s.start && d < s.end
  }
  if (period === 'mois')
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  const start = startOfWeek(now)
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
  return d >= start && d < end
}

/**
 * The match list every section reads: period is the running season, the current
 * calendar month, or the Monday-start week around `now` (untimed matches only
 * appear on « tout »),
 * type follows the owning tournament's kind (unknown → only on « tout »).
 */
export function scopeMatches(
  matches: Match[],
  tournaments: Tournament[],
  filters: StatsFilters,
  now: Date,
): Match[] {
  const kindById = new Map(tournaments.map((t) => [t.id, t.kind]))
  // Doubles matches carry pair display names — no individual to aggregate on.
  return individualMatches(matches, tournaments).filter((m) => {
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

/** One tournament won: its id (to deep-link to the board), name and month. */
export interface PlayerTitle {
  id: string
  name: string
  date: string
}

export interface PlayerTitles {
  count: number
  titles: PlayerTitle[]
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
    entry.titles.push({ id: t.id, name: t.name, date: monthYear(endedAt ?? t.created_at) })
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

export interface FinalsRecord {
  name: string
  played: number
  won: number
}

/** Finals appearances (grand final + the two matches feeding it) per player key. */
export function finalsByPlayer(matches: Match[]): Map<string, FinalsRecord> {
  const out = new Map<string, FinalsRecord>()
  for (const m of matches) {
    if (stakesOf(m) === 'normal') continue
    const aWin = m.score_a > m.score_b
    const sides = [
      { key: sideKey(m.player_a_id, m.player_a), name: m.player_a, won: aWin },
      { key: sideKey(m.player_b_id, m.player_b), name: m.player_b, won: !aWin },
    ]
    for (const side of sides) {
      const r = out.get(side.key) ?? { name: side.name, played: 0, won: 0 }
      r.played++
      if (side.won) r.won++
      out.set(side.key, r)
    }
  }
  return out
}

/** Double-elim titles won after dropping into the loser bracket, per champion name. */
export function remontadasByName(tournaments: Tournament[], matches: Match[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const t of tournaments) {
    if (t.format !== 'double_elim' || t.status !== 'done' || t.champion === null) continue
    const dropped = matches.some(
      (m) =>
        m.tournament_id === t.id &&
        m.bracket === 'L' &&
        (m.player_a === t.champion || m.player_b === t.champion),
    )
    if (dropped) out.set(t.champion, (out.get(t.champion) ?? 0) + 1)
  }
  return out
}

export interface RecordCard {
  icon: string
  label: string
  value: string
  sub: string
}

const plural = (n: number, one: string, many: string): string => `${n} ${n >= 2 ? many : one}`

/** The holder of the highest strictly-positive value, or null when nobody scores. */
function maxBy<T>(items: T[], value: (item: T) => number): T | null {
  let best: T | null = null
  for (const item of items) {
    if (value(item) <= 0) continue
    if (best === null || value(item) > value(best)) best = item
  }
  return best
}

/** The « Joueurs » record cards — each hidden until its feat has happened once. */
export function playerRecords(
  stats: PlayerStat[],
  titles: Map<string, PlayerTitles>,
  finals: Map<string, FinalsRecord>,
  remontadas: Map<string, number>,
): RecordCard[] {
  const cards: RecordCard[] = []

  const serial = [...titles.entries()].sort((a, b) => b[1].count - a[1].count)[0]
  if (serial !== undefined)
    cards.push({
      icon: '🏆',
      label: 'Serial winner',
      value: serial[0],
      sub: plural(serial[1].count, 'tournoi gagné', 'tournois gagnés'),
    })

  const streak = maxBy(stats, (s) => s.longestStreak)
  if (streak !== null && streak.longestStreak >= 2)
    cards.push({
      icon: '🔥',
      label: 'Plus longue série',
      value: streak.name,
      sub: `${streak.longestStreak} victoires d'affilée`,
    })

  const active = maxBy(stats, (s) => s.played)
  if (active !== null)
    cards.push({
      icon: '📈',
      label: 'Plus actif',
      value: active.name,
      sub: plural(active.played, 'match joué', 'matchs joués'),
    })

  const marathon = maxBy(stats, (s) => s.playTimeMs)
  if (marathon !== null)
    cards.push({
      icon: '⏱️',
      label: 'Marathonien',
      value: marathon.name,
      sub: `${fmtPlayTime(marathon.playTimeMs)} de jeu cumulées`,
    })

  const finalist = [...finals.values()].sort((a, b) => b.played - a.played || b.won - a.won)[0]
  if (finalist !== undefined)
    cards.push({
      icon: '🎯',
      label: 'Homme des finales',
      value: finalist.name,
      sub: `${plural(finalist.played, 'finale jouée', 'finales jouées')} · ${plural(finalist.won, 'gagnée', 'gagnées')}`,
    })

  const remontada = [...remontadas.entries()].sort((a, b) => b[1] - a[1])[0]
  if (remontada !== undefined)
    cards.push({
      icon: '🧗',
      label: 'Remontada',
      value: remontada[0],
      sub:
        remontada[1] >= 2
          ? `${remontada[1]} titres décrochés depuis le loser bracket`
          : 'titre décroché depuis le loser bracket',
    })

  const bourreau = maxBy(stats, (s) => s.capotsDealt)
  if (bourreau !== null)
    cards.push({
      icon: '🪑',
      label: 'Bourreau',
      value: bourreau.name,
      sub: plural(bourreau.capotsDealt, 'capot infligé', 'capots infligés'),
    })

  const roi = maxBy(stats, (s) => s.capotsTaken)
  if (roi !== null)
    cards.push({
      icon: '🙈',
      label: 'Roi de la table',
      value: roi.name,
      sub: plural(roi.capotsTaken, 'passage sous la table', 'passages sous la table'),
    })

  const sangFroid = maxBy(stats, (s) => s.matchBallsSaved)
  if (sangFroid !== null)
    cards.push({
      icon: '🧊',
      label: 'Sang-froid',
      value: sangFroid.name,
      sub: plural(sangFroid.matchBallsSaved, 'balle de match sauvée', 'balles de match sauvées'),
    })

  const cardiaque = maxBy(stats, (s) => s.matchBallsWasted)
  if (cardiaque !== null)
    cards.push({
      icon: '😰',
      label: 'Cardiaque',
      value: cardiaque.name,
      sub: plural(cardiaque.matchBallsWasted, 'balle de match gâchée', 'balles de match gâchées'),
    })

  return cards
}

/** The « Matchs » record cards. « Plus de points » was retired (redundant with the closest game). */
export function matchRecords(matches: Match[]): RecordCard[] {
  const supers = computeSuperlatives(matches)
  const line = (m: Match): string => {
    const { winner, loser, ws, ls } = winnerLoser(m)
    return `${winner} ${ws} — ${ls} ${loser}`
  }
  const cards: RecordCard[] = []
  if (supers.longestMatch !== undefined)
    cards.push({
      icon: '⌛',
      label: 'Plus long match',
      value: fmtPlayTime(supers.longestMatch.value),
      sub: line(supers.longestMatch.match),
    })
  if (supers.shortestMatch !== undefined)
    cards.push({
      icon: '⚡',
      label: 'Plus court match',
      value: fmtPlayTime(supers.shortestMatch.value),
      sub: line(supers.shortestMatch.match),
    })
  if (supers.biggestBlowout !== undefined)
    cards.push({
      icon: '📏',
      label: 'Plus gros écart',
      value: `+${supers.biggestBlowout.value}`,
      sub: line(supers.biggestBlowout.match),
    })
  if (supers.closestGame !== undefined) {
    const m = supers.closestGame.match
    cards.push({
      icon: '😬',
      label: 'Match le plus serré',
      value: `${Math.max(m.score_a, m.score_b)} — ${Math.min(m.score_a, m.score_b)}`,
      sub: line(m),
    })
  }
  return cards
}

/** « LEO » — 3-letter matrix header, unambiguous enough with the full-name tooltip. */
export function abbrev(name: string): string {
  const folded = fold(name.trim()).toUpperCase().slice(0, 3)
  return folded === '' ? '?' : folded
}

/** « Les duels les plus serrés : Maxime — Nicolas (5–5) et Émilie — Julien (4–4). » */
export function tightestHint(rivalries: Rivalry[]): string | null {
  if (rivalries.length === 0) return null
  const parts = rivalries.map((r) => `${r.aName} — ${r.bName} (${r.aWins}–${r.bWins})`)
  const joined =
    parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}`
  return `Les duels les plus serrés : ${joined}.`
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
  titles: PlayerTitle[]
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
