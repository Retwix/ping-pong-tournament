import { describe, expect, it } from 'vitest'
import {
  currentSeason,
  daysLeft,
  isClosed,
  nextSeason,
  SEASONS_START,
  seasonById,
  seasonOf,
  seasonWindowLabel,
  seasonsUpTo,
} from './seasons'

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

describe('currentSeason', () => {
  it('is null before the first season starts', () => {
    expect(currentSeason(new Date(2026, 7, 31))).toBeNull()
  })

  it('is the containing season once seasons have begun', () => {
    expect(currentSeason(new Date(2026, 9, 5))?.id).toBe('automne-2026')
  })
})

describe('seasonsUpTo', () => {
  it('is empty before the first season starts', () => {
    expect(seasonsUpTo(new Date(2026, 7, 31))).toEqual([])
  })

  it('lists started seasons newest first', () => {
    expect(seasonsUpTo(new Date(2027, 3, 10)).map((s) => s.id)).toEqual([
      'printemps-2027',
      'hiver-2026',
      'automne-2026',
    ])
  })

  it('excludes a season that has not started yet', () => {
    expect(seasonsUpTo(new Date(2026, 10, 30)).map((s) => s.id)).toEqual(['automne-2026'])
  })
})

describe('nextSeason', () => {
  it('follows the cycle and rolls the year at the turn', () => {
    expect(nextSeason(seasonById('automne-2026')!).id).toBe('hiver-2026')
    expect(nextSeason(seasonById('hiver-2026')!).id).toBe('printemps-2027')
    expect(nextSeason(seasonById('printemps-2027')!).id).toBe('ete-2027')
    expect(nextSeason(seasonById('ete-2027')!).id).toBe('automne-2027')
  })
})

describe('daysLeft', () => {
  it('counts whole days to the end of the window', () => {
    expect(daysLeft(seasonById('automne-2026')!, new Date(2026, 10, 29, 12))).toBe(2)
  })

  it('is zero once the season is over, never negative', () => {
    expect(daysLeft(seasonById('automne-2026')!, new Date(2027, 0, 1))).toBe(0)
  })
})

describe('isClosed', () => {
  it('is false on the last day and true at the boundary', () => {
    const s = seasonById('automne-2026')!
    expect(isClosed(s, new Date(2026, 10, 30, 23, 59))).toBe(false)
    expect(isClosed(s, new Date(2026, 11, 1, 0, 0))).toBe(true)
  })
})

describe('seasonWindowLabel', () => {
  it('reads from the first day to the last day inclusive', () => {
    expect(seasonWindowLabel(seasonById('automne-2026')!)).toBe('1 septembre → 30 novembre 2026')
  })

  it('spans the new year for winter', () => {
    expect(seasonWindowLabel(seasonById('hiver-2026')!)).toBe('1 décembre → 28 février 2027')
  })
})
