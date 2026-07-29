import { describe, expect, it } from 'vitest'
import { recentTournaments } from './recentTournaments'

describe('recentTournaments', () => {
  it('keeps only the leading `limit` entries of a longer list', () => {
    const list = Array.from({ length: 12 }, (_, i) => `t${i}`)
    expect(recentTournaments(list, 10)).toEqual([
      't0',
      't1',
      't2',
      't3',
      't4',
      't5',
      't6',
      't7',
      't8',
      't9',
    ])
  })

  it('defaults to the 10 most recent when no limit is given', () => {
    const list = Array.from({ length: 12 }, (_, i) => `t${i}`)
    const out = recentTournaments(list)
    expect(out).toHaveLength(10)
    expect(out[0]).toBe('t0')
    expect(out[9]).toBe('t9')
  })

  it('returns every entry when the list is shorter than the limit', () => {
    const list = ['a', 'b', 'c']
    expect(recentTournaments(list, 10)).toEqual(['a', 'b', 'c'])
  })

  it('does not mutate the source list', () => {
    const list = Array.from({ length: 12 }, (_, i) => `t${i}`)
    recentTournaments(list, 10)
    expect(list).toHaveLength(12)
  })
})
