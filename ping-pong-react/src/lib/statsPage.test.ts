import { describe, expect, it } from 'vitest'
import type { Match, Tournament } from '../types'
import {
  filterPillLabel,
  isFiltered,
  parseStatsFilters,
  scopeLabel,
  scopeMatches,
  statsSearch,
  type StatsFilters,
} from './statsPage'

const getMockMatch = (overrides?: Partial<Match>): Match => ({
  id: 'm1',
  tournament_id: 't1',
  round: 0,
  idx: 0,
  player_a: 'Léo',
  player_b: 'Thibault',
  player_a_id: 'pa',
  player_b_id: 'pb',
  score_a: 11,
  score_b: 9,
  done: true,
  serve_start: 'a',
  started_at: null,
  ended_at: '2026-07-15T10:00:00.000Z',
  bracket: null,
  match_key: null,
  win_to: null,
  win_slot: null,
  lose_to: null,
  lose_slot: null,
  bye: false,
  mb_saved_a: 0,
  mb_saved_b: 0,
  ...overrides,
})

const getMockTournament = (overrides?: Partial<Tournament>): Tournament => ({
  id: 't1',
  created_at: '2026-07-01T09:00:00.000Z',
  name: 'Tournoi de juillet',
  target: 11,
  players: ['Léo', 'Thibault'],
  status: 'done',
  kind: 'tournament',
  format: 'round_robin',
  champion: 'Léo',
  is_active: false,
  slack_channel: null,
  slack_thread_ts: null,
  result_notified: false,
  chaos_enabled: false,
  chaos_interval: 5,
  chaos_intensity: 'mild',
  chaos_legendary: false,
  ...overrides,
})

const getFilters = (overrides?: Partial<StatsFilters>): StatsFilters => ({
  period: 'tout',
  type: 'tout',
  ...overrides,
})

// Wednesday 15 July 2026, mid-day UTC (timezone-safe for ±2h offsets).
const NOW = new Date('2026-07-15T12:00:00.000Z')

describe('stats filters in the URL', () => {
  it('reads period and type from the query string', () => {
    expect(parseStatsFilters('?p=mois&t=tournois')).toEqual({ period: 'mois', type: 'tournois' })
    expect(parseStatsFilters('?p=semaine')).toEqual({ period: 'semaine', type: 'tout' })
    expect(parseStatsFilters('?t=rapides')).toEqual({ period: 'tout', type: 'rapides' })
  })

  it('falls back to « tout » on missing or unknown values', () => {
    expect(parseStatsFilters('')).toEqual({ period: 'tout', type: 'tout' })
    expect(parseStatsFilters('?p=annee&t=bizarre')).toEqual({ period: 'tout', type: 'tout' })
  })

  it('writes only the non-default filters back to the query string', () => {
    expect(statsSearch(getFilters())).toBe('')
    expect(statsSearch(getFilters({ period: 'mois' }))).toBe('?p=mois')
    expect(statsSearch(getFilters({ type: 'rapides' }))).toBe('?t=rapides')
    expect(statsSearch(getFilters({ period: 'semaine', type: 'tournois' }))).toBe(
      '?p=semaine&t=tournois',
    )
  })

  it('round-trips through parse', () => {
    const filters = getFilters({ period: 'semaine', type: 'rapides' })
    expect(parseStatsFilters(statsSearch(filters))).toEqual(filters)
  })
})

describe('scoping matches by period', () => {
  const july = getMockMatch({ id: 'july', ended_at: '2026-07-02T10:00:00.000Z' })
  const june = getMockMatch({ id: 'june', ended_at: '2026-06-30T10:00:00.000Z' })
  const julyLastYear = getMockMatch({ id: 'old', ended_at: '2025-07-15T10:00:00.000Z' })

  it('keeps everything on « tout »', () => {
    const scoped = scopeMatches([july, june, julyLastYear], [], getFilters(), NOW)
    expect(scoped.map((m) => m.id)).toEqual(['july', 'june', 'old'])
  })

  it('keeps only the current calendar month on « mois » (same month AND year)', () => {
    const scoped = scopeMatches([july, june, julyLastYear], [], getFilters({ period: 'mois' }), NOW)
    expect(scoped.map((m) => m.id)).toEqual(['july'])
  })

  it('keeps Monday through Sunday of the current week on « semaine »', () => {
    const monday = getMockMatch({ id: 'mon', ended_at: '2026-07-13T10:00:00.000Z' })
    const sunday = getMockMatch({ id: 'sun', ended_at: '2026-07-19T10:00:00.000Z' })
    const sundayBefore = getMockMatch({ id: 'prev', ended_at: '2026-07-12T10:00:00.000Z' })
    const mondayAfter = getMockMatch({ id: 'next', ended_at: '2026-07-20T10:00:00.000Z' })
    const scoped = scopeMatches(
      [monday, sunday, sundayBefore, mondayAfter],
      [],
      getFilters({ period: 'semaine' }),
      NOW,
    )
    expect(scoped.map((m) => m.id)).toEqual(['mon', 'sun'])
  })

  it('still finds the current week when « now » is a Sunday', () => {
    const sundayNow = new Date('2026-07-19T12:00:00.000Z')
    const monday = getMockMatch({ id: 'mon', ended_at: '2026-07-13T10:00:00.000Z' })
    const scoped = scopeMatches([monday], [], getFilters({ period: 'semaine' }), sundayNow)
    expect(scoped.map((m) => m.id)).toEqual(['mon'])
  })

  it('falls back to started_at when ended_at is missing, and drops untimed matches', () => {
    const startedOnly = getMockMatch({
      id: 'started',
      ended_at: null,
      started_at: '2026-07-14T10:00:00.000Z',
    })
    const untimed = getMockMatch({ id: 'untimed', ended_at: null, started_at: null })
    const scoped = scopeMatches([startedOnly, untimed], [], getFilters({ period: 'mois' }), NOW)
    expect(scoped.map((m) => m.id)).toEqual(['started'])
    expect(scopeMatches([startedOnly, untimed], [], getFilters(), NOW).map((m) => m.id)).toEqual([
      'started',
      'untimed',
    ])
  })
})

describe('scoping matches by type', () => {
  const tour = getMockTournament({ id: 'tt', kind: 'tournament' })
  const game = getMockTournament({ id: 'tg', kind: 'game' })
  const inTour = getMockMatch({ id: 'a', tournament_id: 'tt' })
  const inGame = getMockMatch({ id: 'b', tournament_id: 'tg' })
  const orphan = getMockMatch({ id: 'c', tournament_id: 'gone' })

  it('« tournois » keeps only matches from real tournaments', () => {
    const scoped = scopeMatches(
      [inTour, inGame, orphan],
      [tour, game],
      getFilters({ type: 'tournois' }),
      NOW,
    )
    expect(scoped.map((m) => m.id)).toEqual(['a'])
  })

  it('« rapides » keeps only quick games', () => {
    const scoped = scopeMatches(
      [inTour, inGame, orphan],
      [tour, game],
      getFilters({ type: 'rapides' }),
      NOW,
    )
    expect(scoped.map((m) => m.id)).toEqual(['b'])
  })

  it('« tout » keeps matches whose tournament is unknown', () => {
    const scoped = scopeMatches([inTour, inGame, orphan], [tour, game], getFilters(), NOW)
    expect(scoped.map((m) => m.id)).toEqual(['a', 'b', 'c'])
  })

  it('combines period and type', () => {
    const juneTour = getMockMatch({
      id: 'jt',
      tournament_id: 'tt',
      ended_at: '2026-06-10T10:00:00.000Z',
    })
    const julyGame = getMockMatch({ id: 'jg', tournament_id: 'tg' })
    const julyTour = getMockMatch({ id: 'jj', tournament_id: 'tt' })
    const scoped = scopeMatches(
      [juneTour, julyGame, julyTour],
      [tour, game],
      getFilters({ period: 'mois', type: 'tournois' }),
      NOW,
    )
    expect(scoped.map((m) => m.id)).toEqual(['jj'])
  })
})

describe('filter labels', () => {
  it('knows when a non-default filter is active', () => {
    expect(isFiltered(getFilters())).toBe(false)
    expect(isFiltered(getFilters({ period: 'mois' }))).toBe(true)
    expect(isFiltered(getFilters({ type: 'tournois' }))).toBe(true)
  })

  it('names only the active filters in the pill', () => {
    expect(filterPillLabel(getFilters({ period: 'mois' }))).toBe('Filtré · Ce mois-ci')
    expect(filterPillLabel(getFilters({ type: 'rapides' }))).toBe('Filtré · Parties rapides')
    expect(filterPillLabel(getFilters({ period: 'semaine', type: 'tournois' }))).toBe(
      'Filtré · Cette semaine · Tournois',
    )
  })

  it('describes the scope with count and lowercased filters', () => {
    expect(scopeLabel(156, getFilters())).toBe('156 matchs · tout · tout')
    expect(scopeLabel(1, getFilters({ period: 'mois', type: 'tournois' }))).toBe(
      '1 match · ce mois-ci · tournois',
    )
    expect(scopeLabel(0, getFilters({ type: 'rapides' }))).toBe('0 match · tout · parties rapides')
  })
})
