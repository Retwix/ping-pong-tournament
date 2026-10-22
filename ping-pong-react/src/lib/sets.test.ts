import { describe, expect, it, test } from 'vitest'
import {
  bestOf,
  finishedSets,
  isMatchBall,
  pointAtStake,
  postsToSlack,
  setsByWinner,
  undoSetValidationPatch,
  validateSetPatch,
} from './sets'
import type { Match, MatchSide, SetScore } from '../types'

describe('bestOf', () => {
  it('reads a tournament created before sets existed as a single game', () => {
    expect(bestOf({})).toBe(1)
  })
})

describe('finishedSets', () => {
  it('reads a match created before sets existed as having no finished set', () => {
    expect(finishedSets({})).toEqual([])
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

describe('validateSetPatch', () => {
  const at = '2026-10-22T18:00:00.000Z'

  test.for<{ when: string; bestOf: number; sets: SetScore[]; a: number; b: number; patch: Partial<Match> | null }>([
    { when: 'A wins set 1 of a Bo3', bestOf: 3, sets: [], a: 11, b: 5, patch: { sets: [[11, 5]], score_a: 0, score_b: 0 } },
    { when: 'B levels a Bo3 at 1-1', bestOf: 3, sets: [[11, 5]], a: 9, b: 11, patch: { sets: [[11, 5], [9, 11]], score_a: 0, score_b: 0 } },
    { when: 'A wins a Bo3 2-0', bestOf: 3, sets: [[11, 5]], a: 11, b: 9, patch: { done: true, ended_at: at } },
    { when: 'A goes 2-0 up in a Bo5', bestOf: 5, sets: [[11, 5]], a: 11, b: 9, patch: { sets: [[11, 5], [11, 9]], score_a: 0, score_b: 0 } },
    { when: 'a single game is won', bestOf: 1, sets: [], a: 11, b: 9, patch: { done: true, ended_at: at } },
    { when: 'the set is not won yet', bestOf: 3, sets: [], a: 10, b: 9, patch: null },
  ])('$when', ({ bestOf, sets, a, b, patch }) => {
    const match = { score_a: a, score_b: b, sets, done: false }
    expect(validateSetPatch(match, { target: 11, bestOf }, at)).toEqual(patch)
  })

  it('does nothing once the match is validated', () => {
    const match = { score_a: 11, score_b: 9, sets: [[11, 5]] satisfies SetScore[], done: true }
    expect(validateSetPatch(match, { target: 11, bestOf: 3 }, at)).toBeNull()
  })
})

describe('undoSetValidationPatch', () => {
  it('brings the last validated set back into play while the new set is 0-0', () => {
    const match = { score_a: 0, score_b: 0, sets: [[11, 5], [8, 11], [11, 7]] satisfies SetScore[] }
    expect(undoSetValidationPatch(match)).toEqual({ sets: [[11, 5], [8, 11]], score_a: 11, score_b: 7 })
  })

  it('locks the last set once a point is scored in the new one', () => {
    const match = { score_a: 0, score_b: 1, sets: [[11, 5]] satisfies SetScore[] }
    expect(undoSetValidationPatch(match)).toBeNull()
  })

  it('has nothing to undo before the first set is validated', () => {
    expect(undoSetValidationPatch({ score_a: 0, score_b: 0, sets: [] })).toBeNull()
  })
})

describe('setsByWinner', () => {
  it('lists every set, the deciding one last, from the winner\'s side', () => {
    const match = { score_a: 9, score_b: 11, sets: [[11, 5], [8, 11]] satisfies SetScore[] }
    expect(setsByWinner(match)).toEqual({ winner: [5, 11, 11], loser: [11, 8, 9] })
  })

  it('reads a single game as its one set', () => {
    expect(setsByWinner({ score_a: 11, score_b: 7, sets: [] })).toEqual({ winner: [11], loser: [7] })
  })
})

describe('postsToSlack', () => {
  it.for([
    { bestOf: 1, posts: true },
    { bestOf: 3, posts: false },
  ])('a party of $bestOf set(s) is announced on Slack: $posts', ({ bestOf, posts }) => {
    expect(postsToSlack({ best_of: bestOf })).toBe(posts)
  })
})
