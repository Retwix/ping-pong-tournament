import { describe, expect, it } from 'vitest'
import type { RatingEvent } from './rating'
import { lastFive, lastRatedAt, recordOf, weeklyDelta, winStreak } from './classement'

const getMockEvent = (overrides?: Partial<RatingEvent>): RatingEvent => ({
  matchId: 'm1',
  key: 'p:leo',
  playerId: 'p1',
  name: 'Léo',
  opponentKey: 'p:thibault',
  opponentName: 'Thibault',
  scoreFor: 11,
  scoreAgainst: 9,
  ratingBefore: 1500,
  ratingAfter: 1512,
  rdBefore: 200,
  rdAfter: 180,
  delta: 12,
  weight: 1,
  stakes: 'normal',
  won: true,
  at: '2026-07-30T10:00:00.000Z',
  ...overrides,
})

describe('lastRatedAt', () => {
  it('returns the most recent timestamp even when events arrive unordered', () => {
    const events = [
      getMockEvent({ at: '2026-07-28T09:00:00.000Z' }),
      getMockEvent({ at: '2026-07-30T17:30:00.000Z' }),
      getMockEvent({ at: '2026-07-29T12:00:00.000Z' }),
    ]
    expect(lastRatedAt(events)).toBe('2026-07-30T17:30:00.000Z')
  })

  it('ignores events without a timestamp', () => {
    const events = [
      getMockEvent({ at: null }),
      getMockEvent({ at: '2026-07-27T08:00:00.000Z' }),
      getMockEvent({ at: null }),
    ]
    expect(lastRatedAt(events)).toBe('2026-07-27T08:00:00.000Z')
  })

  it('returns null when there are no events', () => {
    expect(lastRatedAt([])).toBeNull()
  })

  it('returns null when no event has a timestamp', () => {
    expect(lastRatedAt([getMockEvent({ at: null })])).toBeNull()
  })
})

describe('recordOf', () => {
  it('counts wins and losses for the given player only', () => {
    const events = [
      getMockEvent({ key: 'p:leo', won: true }),
      getMockEvent({ key: 'p:leo', won: false }),
      getMockEvent({ key: 'p:leo', won: true }),
      getMockEvent({ key: 'p:thibault', won: true }),
    ]
    expect(recordOf(events, 'p:leo')).toEqual({ wins: 2, losses: 1 })
  })

  it('returns a zero record for a player with no events', () => {
    expect(recordOf([getMockEvent({ key: 'p:leo' })], 'p:sarah')).toEqual({
      wins: 0,
      losses: 0,
    })
  })
})

describe('lastFive', () => {
  it('returns every result, most recent last, when fewer than five matches', () => {
    const events = [
      getMockEvent({ key: 'p:leo', won: true }),
      getMockEvent({ key: 'p:thibault', won: true }),
      getMockEvent({ key: 'p:leo', won: false }),
    ]
    expect(lastFive(events, 'p:leo')).toEqual([true, false])
  })

  it('keeps only the five most recent results, dropping the oldest', () => {
    const events = [false, true, true, false, true, true].map((won) =>
      getMockEvent({ key: 'p:leo', won }),
    )
    expect(lastFive(events, 'p:leo')).toEqual([true, true, false, true, true])
  })

  it('returns an empty form for a player with no events', () => {
    expect(lastFive([], 'p:leo')).toEqual([])
  })
})

describe('winStreak', () => {
  it('counts consecutive wins from the most recent match backward', () => {
    const events = [true, false, true, true].map((won) => getMockEvent({ key: 'p:leo', won }))
    expect(winStreak(events, 'p:leo')).toBe(2)
  })

  it('is zero when the most recent match was lost', () => {
    const events = [true, true, false].map((won) => getMockEvent({ key: 'p:leo', won }))
    expect(winStreak(events, 'p:leo')).toBe(0)
  })

  it('spans the whole history when the player never lost', () => {
    const events = [true, true, true].map((won) => getMockEvent({ key: 'p:leo', won }))
    expect(winStreak(events, 'p:leo')).toBe(3)
  })

  it('ignores other players’ matches inside the streak window', () => {
    const events = [
      getMockEvent({ key: 'p:leo', won: true }),
      getMockEvent({ key: 'p:thibault', won: false }),
      getMockEvent({ key: 'p:leo', won: true }),
    ]
    expect(winStreak(events, 'p:leo')).toBe(2)
  })

  it('is zero for a player with no events', () => {
    expect(winStreak([], 'p:leo')).toBe(0)
  })
})

describe('weeklyDelta', () => {
  const now = new Date('2026-07-30T12:00:00.000Z')

  it('sums signed deltas of the trailing seven days for the given player', () => {
    const events = [
      getMockEvent({ key: 'p:leo', delta: 12, at: '2026-07-28T10:00:00.000Z' }),
      getMockEvent({ key: 'p:leo', delta: -5, at: '2026-07-29T10:00:00.000Z' }),
      getMockEvent({ key: 'p:thibault', delta: 40, at: '2026-07-29T10:00:00.000Z' }),
    ]
    expect(weeklyDelta(events, 'p:leo', now)).toBe(7)
  })

  it('includes a match exactly seven days old and excludes anything older', () => {
    const events = [
      getMockEvent({ key: 'p:leo', delta: 10, at: '2026-07-23T12:00:00.000Z' }),
      getMockEvent({ key: 'p:leo', delta: 99, at: '2026-07-23T11:59:00.000Z' }),
    ]
    expect(weeklyDelta(events, 'p:leo', now)).toBe(10)
  })

  it('ignores events without a timestamp', () => {
    const events = [getMockEvent({ key: 'p:leo', delta: 25, at: null })]
    expect(weeklyDelta(events, 'p:leo', now)).toBe(0)
  })

  it('is zero when the player played nothing this week', () => {
    expect(weeklyDelta([], 'p:leo', now)).toBe(0)
  })
})
