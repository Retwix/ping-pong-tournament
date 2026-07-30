import { describe, expect, it } from 'vitest'
import type { RatingEvent } from './rating'
import { lastRatedAt } from './classement'

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
