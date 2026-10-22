import { describe, expect, it, test } from 'vitest'
import { bestOf, finishedSets, isMatchBall, pointAtStake } from './sets'
import type { MatchSide, SetScore } from '../types'

describe('bestOf', () => {
  it('reads a tournament created before sets existed as a single game', () => {
    expect(bestOf({})).toBe(1)
  })

  it('reads the number of sets the party was created with', () => {
    expect(bestOf({ best_of: 3 })).toBe(3)
  })
})

describe('finishedSets', () => {
  it('reads a match created before sets existed as having no finished set', () => {
    expect(finishedSets({})).toEqual([])
  })

  it('reads the validated sets of a match', () => {
    expect(finishedSets({ sets: [[11, 5], [8, 11]] })).toEqual([[11, 5], [8, 11]])
  })
})

type StakeRow = {
  when: string
  bestOf: number
  sets: SetScore[]
  a: number
  b: number
  side: MatchSide
  stake: 'match' | 'set' | 'capot' | null
}

describe('pointAtStake', () => {
  test.for<StakeRow>([
    { when: 'a single game at 10-0', bestOf: 1, sets: [], a: 10, b: 0, side: 'a', stake: 'capot' },
    { when: 'a single game at 10-7', bestOf: 1, sets: [], a: 10, b: 7, side: 'a', stake: 'match' },
    { when: 'set 1 of a Bo3 at 10-9', bestOf: 3, sets: [], a: 10, b: 9, side: 'a', stake: 'set' },
    { when: 'set 1 of a Bo3 at deuce 11-10', bestOf: 3, sets: [], a: 11, b: 10, side: 'a', stake: 'set' },
    { when: 'set 1 of a Bo3 at 10-0', bestOf: 3, sets: [], a: 10, b: 0, side: 'a', stake: 'set' },
    { when: 'set 1 of a Bo3 at 9-7', bestOf: 3, sets: [], a: 9, b: 7, side: 'a', stake: null },
    { when: 'the leader at 1-0 in sets, 10-9', bestOf: 3, sets: [[11, 5]], a: 10, b: 9, side: 'a', stake: 'match' },
    { when: 'the trailer at 0-1 in sets, 10-9', bestOf: 3, sets: [[11, 5]], a: 9, b: 10, side: 'b', stake: 'set' },
    { when: 'B leading 1-0 in sets, 9-10', bestOf: 3, sets: [[5, 11]], a: 9, b: 10, side: 'b', stake: 'match' },
    { when: 'the deciding set at 10-0', bestOf: 3, sets: [[11, 5], [5, 11]], a: 10, b: 0, side: 'a', stake: 'match' },
    { when: 'a Bo5 leader at 1-0 in sets', bestOf: 5, sets: [[11, 5]], a: 10, b: 9, side: 'a', stake: 'set' },
    { when: 'a Bo5 leader at 2-0 in sets', bestOf: 5, sets: [[11, 5], [11, 5]], a: 10, b: 9, side: 'a', stake: 'match' },
  ])('$when: $stake', ({ bestOf, sets, a, b, side, stake }) => {
    expect(pointAtStake({ score_a: a, score_b: b, sets }, side, { target: 11, bestOf })).toBe(stake)
  })
})

describe('isMatchBall', () => {
  test.for<Omit<StakeRow, 'stake'> & { matchBall: boolean }>([
    { when: 'a set ball', bestOf: 3, sets: [], a: 10, b: 9, side: 'a', matchBall: false },
    { when: 'a match ball of a Bo3', bestOf: 3, sets: [[11, 5]], a: 10, b: 9, side: 'a', matchBall: true },
    { when: 'a capot ball of a single game', bestOf: 1, sets: [], a: 10, b: 0, side: 'a', matchBall: true },
  ])('$when counts as a match ball: $matchBall', ({ bestOf, sets, a, b, side, matchBall }) => {
    expect(isMatchBall({ score_a: a, score_b: b, sets }, side, { target: 11, bestOf })).toBe(matchBall)
  })
})
