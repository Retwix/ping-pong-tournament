import { expect, it, test, vi } from 'vitest'
import { addKingGame, createTournament, deleteMatch, endKingSession } from './db'
import type { Match } from '../types'

const written = vi.hoisted(() => ({
  rows: new Map<string, ReadonlyArray<object>>(),
  inserts: new Map<string, unknown>(),
  updates: new Array<{ where: Record<string, unknown>; patch: unknown }>(),
  deleted: new Array<{ from: string; id: unknown }>(),
  mayDelete: false,
  refuse: false,
}))

vi.mock('./supabase', () => {
  const registry = [
    { id: 'p-ines', name: 'Inès' },
    { id: 'p-sam', name: 'Sam' },
    { id: 'p-leo', name: 'Léo' },
  ]
  const field = (row: object, key: string): unknown => Object.entries(row).find(([k]) => k === key)?.[1]
  const selecting = (rows: ReadonlyArray<object>) => ({
    eq: (key: string, value: unknown) => selecting(rows.filter((r) => field(r, key) === value)),
    in: (key: string, values: ReadonlyArray<unknown>) => selecting(rows.filter((r) => values.includes(field(r, key)))),
    then: (done: (result: { data: ReadonlyArray<object>; error: null }) => unknown) => done({ data: rows, error: null }),
  })
  const from = (table: string) => ({
    select: () => selecting(table === 'players' ? registry : (written.rows.get(table) ?? [])),
    update: (patch: unknown) => ({
      eq: async (key: string, value: unknown) => {
        written.updates.push({ where: { [key]: value }, patch })
        return { error: null }
      },
    }),
    delete: () => ({
      eq: (key: string, id: unknown) => ({
        select: async () => {
          if (written.mayDelete) written.deleted.push({ from: table, id })
          return { data: written.mayDelete ? [{ id }] : [], error: null }
        },
        then: (done: (result: { error: { message: string } | null }) => unknown) => {
          if (written.refuse) return done({ error: { message: 'refused' } })
          if (key === 'id') written.deleted.push({ from: table, id })
          return done({ error: null })
        },
      }),
    }),
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

it('closes a King of the Ping session left open, crowning it, when any new partie starts', async () => {
  written.updates.splice(0)
  written.rows.set('tournaments', [
    { id: 't-open', kind: 'king', status: 'active' },
    { id: 't-ended', kind: 'king', status: 'done' },
    { id: 't-tournoi', kind: 'tournament', status: 'active' },
  ])
  written.rows.set('matches', [
    getMockGame({ tournament_id: 't-open', idx: 0 }),
    getMockGame({ tournament_id: 't-open', idx: 1, player_b: 'Léo' }),
    getMockGame({ tournament_id: 't-ended', idx: 0, player_a: 'Sam', player_b: 'Léo' }),
  ])

  await createTournament('Partie rapide', ['Sam', 'Léo'], 11, 'game')

  expect(written.updates.filter((u) => 'id' in u.where)).toEqual([
    { where: { id: 't-open' }, patch: { status: 'done', champion: 'Inès' } },
  ])
  written.rows.clear()
})

test.for([
  { who: 'anyone', mayDelete: false, deleted: [], closed: [{ where: { id: 't-empty' }, patch: { status: 'done', champion: null } }] },
  { who: 'a signed-in claimed player', mayDelete: true, deleted: [{ from: 'tournaments', id: 't-empty' }], closed: [] },
])('a session ended before any game, by $who, is deleted when the policy lets them', async ({ mayDelete, deleted, closed }) => {
  written.updates.splice(0)
  written.deleted.splice(0)
  written.mayDelete = mayDelete

  await endKingSession('t-empty', null)

  expect({ deleted: written.deleted, closed: written.updates.filter((u) => 'id' in u.where) }).toEqual({ deleted, closed })
  written.mayDelete = false
})

it('abandoning a game deletes its match, so nothing of it is recorded', async () => {
  written.deleted.splice(0)

  await deleteMatch('m-abandoned')

  expect(written.deleted).toEqual([{ from: 'matches', id: 'm-abandoned' }])
})

it('reports an abandon the database refused, so the game is not dropped on this phone alone', async () => {
  written.refuse = true

  await expect(deleteMatch('m-abandoned')).rejects.toMatchObject({ message: 'refused' })
  written.refuse = false
})
