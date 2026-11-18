import { expect, it, vi } from 'vitest'
import { createTournament } from './db'

const written = vi.hoisted(() => ({ inserts: new Map<string, unknown>() }))

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
      return Object.assign(Promise.resolve({ error: null }), {
        select: () => ({ single: async () => ({ data: { id: 't-king' }, error: null }) }),
      })
    },
  })
  return { supabase: { from } }
})

it('starts a King of the Ping session with only the first two of the shuffled rotation at the table', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0)

  await createTournament('King of the Ping', ['Léo', 'Inès', 'Sam'], 7, 'king')

  expect(written.inserts.get('tournaments')).toMatchObject({
    kind: 'king',
    players: ['Inès', 'Sam', 'Léo'],
  })
  expect(written.inserts.get('matches')).toEqual([
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
