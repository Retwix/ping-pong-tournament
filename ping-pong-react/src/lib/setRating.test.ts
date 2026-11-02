import { describe, expect, it } from 'vitest'
import { replayRatings } from './rating'
import type { Match, SetScore } from '../types'

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
  score_b: 5,
  done: true,
  serve_start: 'a',
  started_at: null,
  ended_at: '2026-11-02T10:00:00.000Z',
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

const weightOf = (match: Match): number[] =>
  replayRatings([match], [], { targetByTournament: new Map([['t1', 11]]) }).events.map(
    (e) => e.weight,
  )

describe('the Elo weight of a ranked match of sets', () => {
  it.for<{ result: string; sets: SetScore[]; final: [number, number]; weight: number }>([
    { result: 'Bo3 2-0', sets: [[11, 5]], final: [11, 7], weight: 1.75 },
    { result: 'Bo3 2-1', sets: [[11, 5], [8, 11]], final: [11, 9], weight: 1.375 },
    { result: 'Bo3 1-2', sets: [[11, 5], [8, 11]], final: [9, 11], weight: 1.375 },
    { result: 'Bo5 3-1', sets: [[11, 5], [9, 11], [11, 7]], final: [11, 3], weight: 1.5 },
  ])('$result weighs $weight for both players, whatever the points', ({ sets, final, weight }) => {
    const [a, b] = weightOf(getMockMatch({ sets, score_a: final[0], score_b: final[1] }))
    expect(a).toBeCloseTo(weight)
    expect(b).toBeCloseTo(weight)
  })

  it('leaves a single game weighted by its point margin', () => {
    expect(weightOf(getMockMatch({ score_a: 11, score_b: 5 }))[0]).toBeCloseTo(1 + 0.75 * (6 / 11))
  })
})

describe('the sets a rating event carries', () => {
  const eventsOf = (match: Match) =>
    replayRatings([match], []).events.map((e) => ({ name: e.name, sets: e.sets }))

  it('lists every set of a match of sets from each player’s side, the deciding set last', () => {
    const match = getMockMatch({ sets: [[11, 5], [8, 11]], score_a: 11, score_b: 9 })
    expect(eventsOf(match)).toEqual([
      { name: 'Léo', sets: [[11, 5], [8, 11], [11, 9]] },
      { name: 'Thibault', sets: [[5, 11], [11, 8], [9, 11]] },
    ])
  })

  it('gives a single game its one score, from each side', () => {
    expect(eventsOf(getMockMatch({ score_a: 11, score_b: 5 }))).toEqual([
      { name: 'Léo', sets: [[11, 5]] },
      { name: 'Thibault', sets: [[5, 11]] },
    ])
  })
})
