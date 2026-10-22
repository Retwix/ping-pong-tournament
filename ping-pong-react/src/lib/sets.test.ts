import { describe, expect, it } from 'vitest'
import { bestOf, finishedSets } from './sets'

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
