import { describe, expect, it } from 'vitest'
import type { Match } from '../types'
import { individualMatches, membresPaire, nomPaire } from './doubles'

const getMockMatch = (overrides?: Partial<Match>): Match => ({
  id: 'm1',
  tournament_id: 't1',
  round: 0,
  idx: 0,
  player_a: 'Léo & Inès',
  player_b: 'Karim & Julie',
  player_a_id: null,
  player_b_id: null,
  score_a: 11,
  score_b: 9,
  done: true,
  serve_start: 'a',
  started_at: null,
  ended_at: '2026-08-01T10:00:00.000Z',
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

describe('membresPaire', () => {
  it('splits a pair display name into its two players', () => {
    expect(membresPaire('Léo & Inès')).toEqual(['Léo', 'Inès'])
  })

  it('returns a single player untouched', () => {
    expect(membresPaire('Thibault')).toEqual(['Thibault'])
  })

  it('round-trips with nomPaire', () => {
    expect(nomPaire(membresPaire('Karim & Julie'))).toBe('Karim & Julie')
  })
})

describe('individualMatches', () => {
  const double = { id: 'td', doubles: true }
  const simple = { id: 'ts', doubles: false }

  it('drops matches that belong to a doubles game', () => {
    const matches = [
      getMockMatch({ id: 'd', tournament_id: 'td' }),
      getMockMatch({ id: 's', tournament_id: 'ts' }),
    ]
    expect(individualMatches(matches, [double, simple]).map((m) => m.id)).toEqual(['s'])
  })

  it('treats a missing doubles flag (pre-migration row) as individual', () => {
    const matches = [getMockMatch({ id: 'old', tournament_id: 'tv' })]
    expect(individualMatches(matches, [{ id: 'tv' }])).toEqual(matches)
  })

  it('keeps matches whose tournament is unknown', () => {
    const matches = [getMockMatch({ id: 'orphan', tournament_id: 'gone' })]
    expect(individualMatches(matches, [double])).toEqual(matches)
  })
})
