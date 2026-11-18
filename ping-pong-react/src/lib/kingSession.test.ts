import { expect, it, vi } from 'vitest'
import { addKingGame, createTournament } from './db'
import type { Match } from '../types'

const written = vi.hoisted(() => ({ inserts: new Map<string, unknown>(), refuse: false }))

vi.mock('./supabase', () => {
  const registry = [
    { id: 'p-ines', name: 'Inès' },
    { id: 'p-sam', name: 'Sam' },
    { id: 'p-leo', name: 'Léo' },
  ]
  const from = (table: string) => ({
    select: async () => ({ data: registry, error: null }),
    update: () => ({ eq: async () => ({ error: null }) }),
    insert: (row: unknown) => {
      written.inserts.set(table, row)
      const error = written.refuse ? { message: 'refused' } : null
      return Object.assign(Promise.resolve({ error }), {
        select: () => ({ single: async () => ({ data: { id: 't-king' }, error: null }) }),
      })
    },
  })
  return { supabase: { from } }
})

const getMockGame = (overrides?: Partial<Match>): Match => ({
  id: 'm0',
  tournament_id: 't-king',
  round: 1,
  idx: 0,
  player_a: 'Inès',
  player_b: 'Sam',
  player_a_id: 'p-ines',
  player_b_id: 'p-sam',
  score_a: 7,
  score_b: 4,
  done: true,
  serve_start: 'b',
  started_at: null,
  ended_at: null,
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

const insertedMatches = () => [written.inserts.get('matches')].flat()

it('starts a King of the Ping session with only the first two of the shuffled rotation at the table', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0)

  await createTournament('King of the Ping', ['Léo', 'Inès', 'Sam'], 7, 'king')

  expect(written.inserts.get('tournaments')).toMatchObject({
    kind: 'king',
    players: ['Inès', 'Sam', 'Léo'],
  })
  expect(insertedMatches()).toEqual([
    expect.objectContaining({
      tournament_id: 't-king',
      round: 1,
      idx: 0,
      player_a: 'Inès',
      player_b: 'Sam',
      player_a_id: 'p-ines',
      player_b_id: 'p-sam',
      serve_start: 'b',
      done: false,
    }),
  ])
})

it('appends the next game after the last one played, the rotation calling the next two', async () => {
  await addKingGame('t-king', ['Inès', 'Léo', 'Sam'], [getMockGame({ idx: 0, round: 1 })])

  expect(insertedMatches()).toEqual([
    expect.objectContaining({
      tournament_id: 't-king',
      round: 2,
      idx: 1,
      player_a: 'Inès',
      player_b: 'Léo',
      player_a_id: 'p-ines',
      player_b_id: 'p-leo',
      serve_start: 'b',
      score_a: 0,
      score_b: 0,
      done: false,
    }),
  ])
})

it('reports a next game the database refused, rather than leaving the table empty', async () => {
  written.refuse = true

  await expect(addKingGame('t-king', ['Inès', 'Léo', 'Sam'], [getMockGame()])).rejects.toMatchObject({
    message: 'refused',
  })
  written.refuse = false
})
