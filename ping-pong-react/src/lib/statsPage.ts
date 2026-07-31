// Pure selectors for the « Les stats » page (/stats).

import type { Match, Tournament } from '../types'

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
