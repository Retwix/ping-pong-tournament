import { describe, expect, it } from 'vitest'
import { TBD } from '../types'
import type { Match } from '../types'
import { refStart } from './refMode'

const getMockMatch = (overrides?: Partial<Match>): Match => ({
  id: 'm1',
  tournament_id: 't1',
  round: 1,
  idx: 0,
  player_a: 'Léo',
  player_b: 'Thibault',
  player_a_id: 'pa',
  player_b_id: 'pb',
  score_a: 0,
  score_b: 0,
  done: false,
  serve_start: 'a',
  started_at: null,
  first_point_at: null,
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

const MAINTENANT = '2026-08-24T10:00:00.000Z'

describe('refStart', () => {
  it('starts the match the referee has on screen, before any point is played', () => {
    const matches = [getMockMatch({ id: 'a' }), getMockMatch({ id: 'b' })]
    expect(refStart(matches, 'b', MAINTENANT)).toEqual({
      id: 'b',
      patch: { started_at: MAINTENANT },
    })
  })

  it('writes nothing once the match is started, so the start time never moves', () => {
    const matches = [getMockMatch({ id: 'a', started_at: '2026-08-24T09:00:00.000Z' })]
    expect(refStart(matches, 'a', MAINTENANT)).toBeNull()
  })

  it('writes nothing for the finished match held on the « à suivre » screen', () => {
    const matches = [getMockMatch({ id: 'a', done: true, score_a: 11, score_b: 6 })]
    expect(refStart(matches, 'a', MAINTENANT)).toBeNull()
  })

  it('writes nothing for a bracket match still waiting on its players', () => {
    const matches = [getMockMatch({ id: 'a', player_b: TBD, player_b_id: null })]
    expect(refStart(matches, 'a', MAINTENANT)).toBeNull()
  })

  it('writes nothing when the view has no match on screen', () => {
    expect(refStart([getMockMatch({ id: 'a' })], null, MAINTENANT)).toBeNull()
    expect(refStart([getMockMatch({ id: 'a' })], 'gone', MAINTENANT)).toBeNull()
  })
})
