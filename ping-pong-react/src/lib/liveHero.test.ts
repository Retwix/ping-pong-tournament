import { describe, expect, it } from 'vitest'
import type { Match } from '../types'
import { isLive, pickLiveMatch } from './liveHero'

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    tournament_id: 't1',
    round: 0,
    idx: 0,
    player_a: 'Alice',
    player_b: 'Bob',
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
  }
}

describe('isLive', () => {
  it('is true once a point has been scored', () => {
    expect(isLive(makeMatch({ score_a: 3 }))).toBe(true)
  })
  it('is true once the match has an explicit start', () => {
    expect(isLive(makeMatch({ started_at: '2026-07-27T10:00:00Z' }))).toBe(true)
  })
  it('is false for a fresh 0–0 match', () => {
    expect(isLive(makeMatch())).toBe(false)
  })
  it('is false for a finished match', () => {
    expect(isLive(makeMatch({ score_a: 11, score_b: 5, done: true }))).toBe(false)
  })
})

describe('pickLiveMatch', () => {
  it('returns the in-progress match', () => {
    const m = pickLiveMatch([makeMatch({ id: 'a' }), makeMatch({ id: 'b', score_a: 4 })])
    expect(m?.id).toBe('b')
  })
  it('returns null when nothing is live', () => {
    expect(pickLiveMatch([makeMatch(), makeMatch({ done: true, score_a: 11 })])).toBeNull()
  })
})
