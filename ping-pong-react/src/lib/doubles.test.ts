import { describe, expect, it } from 'vitest'
import type { Match } from '../types'
import type { SelectionDouble } from './nouvellePartie'
import { individualMatches, melangerEquipes, membresPaire, nomPaire, tirerEquipes } from './doubles'

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
  first_point_at: null,
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

const QUATRE = ['Léo', 'Inès', 'Karim', 'Julie']

describe('tirerEquipes', () => {
  it('pairs the first two players when the rng lands on the first split', () => {
    expect(tirerEquipes(QUATRE, () => 0)).toEqual([
      ['Léo', 'Inès'],
      ['Karim', 'Julie'],
    ])
  })

  it('crosses the pairs for a middle rng value', () => {
    expect(tirerEquipes(QUATRE, () => 0.4)).toEqual([
      ['Léo', 'Karim'],
      ['Inès', 'Julie'],
    ])
  })

  it('pairs first with last when the rng approaches one', () => {
    expect(tirerEquipes(QUATRE, () => 0.99)).toEqual([
      ['Léo', 'Julie'],
      ['Inès', 'Karim'],
    ])
  })

  it('always deals the four players out exactly once', () => {
    const [a, b] = tirerEquipes(QUATRE, () => 0.6)
    expect([...a, ...b].sort()).toEqual([...QUATRE].sort())
  })
})

describe('melangerEquipes', () => {
  const getSel = (): SelectionDouble => ({
    a: ['Léo', 'Inès'],
    b: ['Karim', 'Julie'],
    camp: 'B',
  })

  it('re-deals into the first cross split for a low rng', () => {
    expect(melangerEquipes(getSel(), () => 0)).toEqual({
      a: ['Léo', 'Karim'],
      b: ['Inès', 'Julie'],
      camp: 'B',
    })
  })

  it('re-deals into the other cross split for a high rng', () => {
    expect(melangerEquipes(getSel(), () => 0.9)).toEqual({
      a: ['Léo', 'Julie'],
      b: ['Inès', 'Karim'],
      camp: 'B',
    })
  })

  it('takes the second cross split at the exact rng boundary', () => {
    expect(melangerEquipes(getSel(), () => 0.5)).toEqual({
      a: ['Léo', 'Julie'],
      b: ['Inès', 'Karim'],
      camp: 'B',
    })
  })

  it('never returns the current duos, whatever the rng', () => {
    for (const r of [0, 0.2, 0.49, 0.5, 0.7, 0.99]) {
      const next = melangerEquipes(getSel(), () => r)
      expect(next.a).not.toEqual(['Léo', 'Inès'])
      expect([...next.a, ...next.b].sort()).toEqual([...QUATRE].sort())
    }
  })

  it('does not mutate the incoming selection', () => {
    const sel = getSel()
    melangerEquipes(sel, () => 0)
    expect(sel).toEqual(getSel())
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
