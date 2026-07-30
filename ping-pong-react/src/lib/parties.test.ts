import { describe, expect, it } from 'vitest'
import type { Match, Tournament } from '../types'
import { historySubtitle, parseFilter, tournamentRows } from './parties'

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
  ended_at: '2026-07-30T10:00:00.000Z',
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

describe('historySubtitle', () => {
  it('counts finished matches and finished tournaments', () => {
    const matches = [
      getMockMatch({ id: 'm1' }),
      getMockMatch({ id: 'm2' }),
      getMockMatch({ id: 'm3', done: false }),
    ]
    const tournaments = [
      getMockTournament({ id: 't1' }),
      getMockTournament({ id: 't2' }),
      getMockTournament({ id: 't3', status: 'active' }),
      getMockTournament({ id: 't4', kind: 'game' }),
    ]
    expect(historySubtitle(matches, tournaments)).toBe('2 matchs notés · 2 tournois terminés')
  })

  it('uses the singular for exactly one of each', () => {
    expect(historySubtitle([getMockMatch()], [getMockTournament()])).toBe(
      '1 match noté · 1 tournoi terminé',
    )
  })

  it('keeps the singular at zero (French rule)', () => {
    expect(historySubtitle([], [])).toBe('0 match noté · 0 tournoi terminé')
  })
})

describe('tournamentRows', () => {
  const roundRobin = (tournamentId: string, hourOffset = 0): Match[] => [
    getMockMatch({
      id: `${tournamentId}-m1`,
      tournament_id: tournamentId,
      player_a: 'Ana',
      player_b: 'Bo',
      score_a: 11,
      score_b: 5,
      ended_at: `2026-07-10T${10 + hourOffset}:00:00.000Z`,
    }),
    getMockMatch({
      id: `${tournamentId}-m3`,
      tournament_id: tournamentId,
      player_a: 'Bo',
      player_b: 'Cy',
      score_a: 11,
      score_b: 9,
      ended_at: `2026-07-10T${12 + hourOffset}:00:00.000Z`,
    }),
    getMockMatch({
      id: `${tournamentId}-m2`,
      tournament_id: tournamentId,
      player_a: 'Ana',
      player_b: 'Cy',
      score_a: 11,
      score_b: 7,
      ended_at: `2026-07-10T${11 + hourOffset}:00:00.000Z`,
    }),
  ]
  const doneTournament = (overrides?: Partial<Tournament>): Tournament =>
    getMockTournament({ players: ['Ana', 'Bo', 'Cy'], champion: 'Ana', ...overrides })

  it('keeps only real tournaments, not quick games', () => {
    const rows = tournamentRows(
      [doneTournament({ id: 't1' }), doneTournament({ id: 'g1', kind: 'game' })],
      [],
    )
    expect(rows.map((r) => r.id)).toEqual(['t1'])
  })

  it('derives champion, finalist and end date from the tournament matches', () => {
    const rows = tournamentRows([doneTournament({ id: 't1' })], roundRobin('t1'))
    expect(rows).toEqual([
      {
        id: 't1',
        name: 'Tournoi de juillet',
        playersCount: 3,
        formatLabel: 'Round robin',
        active: false,
        champion: 'Ana',
        finalist: 'Bo',
        endedAt: '2026-07-10T12:00:00.000Z',
      },
    ])
  })

  it('ignores matches of other tournaments', () => {
    const rows = tournamentRows(
      [doneTournament({ id: 't1' })],
      [...roundRobin('t1'), ...roundRobin('t2', 5)],
    )
    expect(rows[0].endedAt).toBe('2026-07-10T12:00:00.000Z')
    expect(rows[0].finalist).toBe('Bo')
  })

  it('shows an active tournament without champion, finalist or end date', () => {
    const rows = tournamentRows(
      [doneTournament({ id: 't1', status: 'active', champion: null })],
      [],
    )
    expect(rows[0]).toMatchObject({ active: true, champion: null, finalist: null, endedAt: null })
  })

  it('labels the double-elimination format', () => {
    const rows = tournamentRows([doneTournament({ id: 't1', format: 'double_elim' })], [])
    expect(rows[0].formatLabel).toBe('Double élimination')
  })

  it('orders active tournaments first, then the most recently finished', () => {
    const tournaments = [
      doneTournament({ id: 'old', created_at: '2026-06-01T09:00:00.000Z' }),
      doneTournament({ id: 'fresh', created_at: '2026-06-02T09:00:00.000Z' }),
      doneTournament({
        id: 'live',
        status: 'active',
        champion: null,
        created_at: '2026-05-01T09:00:00.000Z',
      }),
    ]
    const rows = tournamentRows(tournaments, [...roundRobin('fresh', 5), ...roundRobin('old')])
    expect(rows.map((r) => r.id)).toEqual(['live', 'fresh', 'old'])
  })

  it('has no finalist when the roster kept a single player', () => {
    const rows = tournamentRows(
      [doneTournament({ id: 't1', players: ['Ana'] })],
      [getMockMatch({ id: 'x', tournament_id: 't1', player_a: 'Ana', player_b: 'Zoé' })],
    )
    expect(rows[0].finalist).toBeNull()
  })

  it('falls back to the creation date when a finished tournament has no matches', () => {
    const tournaments = [
      doneTournament({ id: 'early', created_at: '2026-06-01T09:00:00.000Z' }),
      doneTournament({ id: 'late', created_at: '2026-07-01T09:00:00.000Z' }),
    ]
    const rows = tournamentRows(tournaments, [])
    expect(rows.map((r) => r.id)).toEqual(['late', 'early'])
    expect(rows[0].endedAt).toBeNull()
    expect(rows[0].finalist).toBeNull()
  })
})

describe('parseFilter', () => {
  it('defaults to all without a query string', () => {
    expect(parseFilter('')).toBe('all')
  })

  it('reads the match filter from ?f=match', () => {
    expect(parseFilter('?f=match')).toBe('match')
  })

  it('reads the tournament filter from ?f=tour', () => {
    expect(parseFilter('?f=tour')).toBe('tour')
  })

  it('falls back to all for unknown values', () => {
    expect(parseFilter('?f=everything')).toBe('all')
  })

  it('finds the filter among other params', () => {
    expect(parseFilter('?utm=x&f=tour')).toBe('tour')
  })
})
