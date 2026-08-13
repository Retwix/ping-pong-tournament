import { describe, expect, it } from 'vitest'
import { seasonOf, seasonById, SEASONS_START } from './seasons'

const at = (y: number, m: number, d: number, h = 12): string =>
  new Date(y, m, d, h).toISOString()

describe('seasonOf', () => {
  it('maps September, October and November to autumn of that year', () => {
    expect(seasonOf(at(2026, 8, 1))).toBe('automne-2026')
    expect(seasonOf(at(2026, 9, 15))).toBe('automne-2026')
    expect(seasonOf(at(2026, 10, 30))).toBe('automne-2026')
  })

  it('maps December to the winter starting that year', () => {
    expect(seasonOf(at(2026, 11, 1))).toBe('hiver-2026')
  })

  it('maps January and February to the winter that started the previous December', () => {
    expect(seasonOf(at(2027, 0, 15))).toBe('hiver-2026')
    expect(seasonOf(at(2027, 1, 28))).toBe('hiver-2026')
  })

  it('returns null before seasons began', () => {
    expect(seasonOf(at(2026, 7, 31))).toBeNull()
  })

  it('returns null for an undated match', () => {
    expect(seasonOf(null)).toBeNull()
  })

  it('begins exactly at local midnight on 1 September 2026', () => {
    expect(SEASONS_START.getTime()).toBe(new Date(2026, 8, 1).getTime())
    expect(seasonOf(new Date(2026, 8, 1, 0, 0, 0).toISOString())).toBe('automne-2026')
    expect(seasonOf(new Date(2026, 7, 31, 23, 59, 59).toISOString())).toBeNull()
  })
})

describe('seasonById', () => {
  it('labels winter across two years', () => {
    expect(seasonById('hiver-2026')?.label).toBe('Saison Hiver 2026-27')
  })

  it('labels the other three with a single year', () => {
    expect(seasonById('automne-2026')?.label).toBe('Saison Automne 2026')
    expect(seasonById('printemps-2027')?.label).toBe('Saison Printemps 2027')
    expect(seasonById('ete-2027')?.label).toBe('Saison Été 2027')
  })

  it('ends winter at the start of March, so leap years need no special case', () => {
    expect(seasonById('hiver-2027')?.end.getTime()).toBe(new Date(2028, 2, 1).getTime())
  })

  it('returns null for a malformed id', () => {
    expect(seasonById('nawak-2026')).toBeNull()
    expect(seasonById('automne')).toBeNull()
    expect(seasonById('automne-abcd')).toBeNull()
  })
})
