import { describe, expect, it } from 'vitest'
import type { Match, Tournament } from '../types'
import { historySubtitle, parseFilter } from './parties'

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
