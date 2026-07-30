import { describe, expect, it } from 'vitest'
import type { RatingEvent, RatingRow } from './rating'
import { lastFive, lastRatedAt, podium, recordOf, weeklyDelta, winStreak } from './classement'

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

const getMockRow = (overrides?: Partial<RatingRow>): RatingRow => ({
  key: 'p:leo',
  playerId: 'p1',
  name: 'Léo',
  rating: 1500,
  rd: 80,
  vol: 0.06,
  games: 10,
  peak: 1520,
  lastPlayedAt: '2026-07-30T10:00:00.000Z',
  rank: 1,
  provisional: false,
  team: 'Tech',
  avatar_url: null,
  trend: 0,
  ...overrides,
})

describe('podium', () => {
  const now = new Date('2026-07-30T12:00:00.000Z')

  it('returns null when fewer than three players are ranked', () => {
    const rows = [
      getMockRow(),
      getMockRow({ key: 'p:thibault', name: 'Thibault', rank: 2, rating: 1450 }),
      getMockRow({ key: 'p:max', name: 'Maxime', rank: 3, rating: 1400, provisional: true }),
    ]
    expect(podium(rows, [], now)).toBeNull()
  })

  it('crowns the top three ranked players, skipping provisional rows', () => {
    const rows = [
      getMockRow({ rating: 1500 }),
      getMockRow({ key: 'p:max', name: 'Maxime', rank: 2, rating: 1490, provisional: true }),
      getMockRow({ key: 'p:thibault', name: 'Thibault', rank: 3, rating: 1450 }),
      getMockRow({ key: 'p:candice', name: 'Candice', rank: 4, rating: 1400 }),
    ]
    const pod = podium(rows, [], now)
    expect(pod?.first.row.name).toBe('Léo')
    expect(pod?.second.row.name).toBe('Thibault')
    expect(pod?.third.row.name).toBe('Candice')
  })

  it('gives the leader its record and weekly delta, without a note', () => {
    const rows = [
      getMockRow({ rating: 1500 }),
      getMockRow({ key: 'p:thibault', name: 'Thibault', rank: 2, rating: 1450 }),
      getMockRow({ key: 'p:candice', name: 'Candice', rank: 3, rating: 1400 }),
    ]
    const events = [
      getMockEvent({ key: 'p:leo', won: true, delta: 12, at: '2026-07-29T10:00:00.000Z' }),
      getMockEvent({ key: 'p:leo', won: false, delta: -4, at: '2026-07-29T11:00:00.000Z' }),
      getMockEvent({ key: 'p:leo', won: true, delta: 9, at: '2026-06-01T10:00:00.000Z' }),
    ]
    const pod = podium(rows, events, now)
    expect(pod?.first.record).toEqual({ wins: 2, losses: 1 })
    expect(pod?.first.delta7).toBe(8)
    expect(pod?.first.note).toBeNull()
  })

  it('describes the runner-up by its record and displayed gap to the title', () => {
    const rows = [
      getMockRow({ rating: 1487.4 }),
      getMockRow({ key: 'p:thibault', name: 'Thibault', rank: 2, rating: 1442.6 }),
      getMockRow({ key: 'p:candice', name: 'Candice', rank: 3, rating: 1400 }),
    ]
    const events = [
      getMockEvent({ key: 'p:thibault', won: true }),
      getMockEvent({ key: 'p:thibault', won: true }),
      getMockEvent({ key: 'p:thibault', won: false }),
    ]
    expect(podium(rows, events, now)?.second.note).toBe('2–1 · à 44 points du titre')
  })

  it('describes the third by its current win streak when on a run', () => {
    const rows = [
      getMockRow({ rating: 1500 }),
      getMockRow({ key: 'p:thibault', name: 'Thibault', rank: 2, rating: 1450 }),
      getMockRow({ key: 'p:candice', name: 'Candice', rank: 3, rating: 1400 }),
    ]
    const events = [
      getMockEvent({ key: 'p:candice', won: true }),
      getMockEvent({ key: 'p:candice', won: true }),
    ]
    expect(podium(rows, events, now)?.third.note).toBe("2–0 · 2 victoires d'affilée")
  })

  it('falls back to the title gap when the third has no streak going', () => {
    const rows = [
      getMockRow({ rating: 1500 }),
      getMockRow({ key: 'p:thibault', name: 'Thibault', rank: 2, rating: 1450 }),
      getMockRow({ key: 'p:candice', name: 'Candice', rank: 3, rating: 1400 }),
    ]
    const events = [
      getMockEvent({ key: 'p:candice', won: true }),
      getMockEvent({ key: 'p:candice', won: false }),
    ]
    expect(podium(rows, events, now)?.third.note).toBe('1–1 · à 100 points du titre')
  })
})
