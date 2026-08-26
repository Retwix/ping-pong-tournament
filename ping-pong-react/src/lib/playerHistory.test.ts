import { describe, expect, it } from 'vitest'
import { perDayPoints, playerHistory } from './playerHistory'
import type { RatingEvent, RatingRow } from './rating'

const event = (over: Partial<RatingEvent> = {}): RatingEvent => ({
  matchId: 'm1',
  key: 'alice',
  playerId: 'alice',
  name: 'Alice',
  opponentKey: 'bob',
  opponentName: 'Bob',
  scoreFor: 11,
  scoreAgainst: 5,
  ratingBefore: 1500,
  ratingAfter: 1512,
  rdBefore: 350,
  rdAfter: 300,
  delta: 12,
  weight: 1,
  stakes: 'normal',
  won: true,
  at: '2026-07-01T10:00:00Z',
  ...over,
})

const row = (over: Partial<RatingRow> = {}): RatingRow => ({
  key: 'alice',
  playerId: 'alice',
  name: 'Alice',
  rating: 1512,
  rd: 300,
  vol: 0.06,
  games: 1,
  peak: 1512,
  lastPlayedAt: '2026-07-01T10:00:00Z',
  rank: 1,
  provisional: true,
  team: 'tech',
  avatar_url: null,
  trend: 12,
  ...over,
})

describe('playerHistory', () => {
  it('returns null for a player with no rated matches', () => {
    expect(playerHistory([], [row()], 'alice')).toBeNull()
  })

  it('returns null for a player missing from the ranked rows', () => {
    expect(playerHistory([event()], [], 'alice')).toBeNull()
  })

  it('anchors the chart at 1500 then follows each match rating, in order', () => {
    const events = [
      event({ matchId: 'm1', ratingAfter: 1512, at: '2026-07-01T10:00:00Z' }),
      event({ matchId: 'm2', ratingAfter: 1498, won: false, at: '2026-07-02T10:00:00Z' }),
      event({ matchId: 'm3', ratingAfter: 1520, at: '2026-07-03T10:00:00Z' }),
    ]
    const h = playerHistory(events, [row()], 'alice')
    expect(h?.points.map((p) => ({ at: p.at, rating: p.rating }))).toEqual([
      { at: null, rating: 1500 },
      { at: '2026-07-01T10:00:00Z', rating: 1512 },
      { at: '2026-07-02T10:00:00Z', rating: 1498 },
      { at: '2026-07-03T10:00:00Z', rating: 1520 },
    ])
  })

  it('carries the opponent and score of each match on its point', () => {
    const events = [
      event({ matchId: 'm1', opponentName: 'Bob', scoreFor: 11, scoreAgainst: 5, won: true }),
      event({
        matchId: 'm2',
        opponentName: 'Carol',
        scoreFor: 9,
        scoreAgainst: 11,
        won: false,
        at: '2026-07-02T10:00:00Z',
      }),
    ]
    const h = playerHistory(events, [row()], 'alice')
    expect(h?.points.map((p) => p.match)).toEqual([
      undefined,
      { opponent: 'Bob', scoreFor: 11, scoreAgainst: 5, won: true },
      { opponent: 'Carol', scoreFor: 9, scoreAgainst: 11, won: false },
    ])
  })

  it("ignores other players' events", () => {
    const events = [event(), event({ matchId: 'm2', key: 'bob', name: 'Bob', won: false })]
    const h = playerHistory(events, [row()], 'alice')
    expect(h?.games).toBe(1)
    expect(h?.points).toHaveLength(2)
  })

  it('counts wins, losses and win rate from the won flags', () => {
    const events = [
      event({ matchId: 'm1', won: true }),
      event({ matchId: 'm2', won: true }),
      event({ matchId: 'm3', won: true }),
      event({ matchId: 'm4', won: false }),
    ]
    const h = playerHistory(events, [row()], 'alice')
    expect(h?.wins).toBe(3)
    expect(h?.losses).toBe(1)
    expect(h?.games).toBe(4)
    expect(h?.winRate).toBe(0.75)
  })

  it('reads rank and total from the ranked rows', () => {
    const rows = [
      row({ key: 'bob', name: 'Bob', rank: 1 }),
      row({ rank: 2 }),
      row({ key: 'carol', name: 'Carol', rank: 3 }),
    ]
    const h = playerHistory([event()], rows, 'alice')
    expect(h?.rank).toBe(2)
    expect(h?.total).toBe(3)
  })

  it('reports peak as the best rating reached in play, ignoring the row peak', () => {
    const events = [
      event({ matchId: 'm1', ratingAfter: 1522 }),
      event({ matchId: 'm2', ratingAfter: 1563 }),
      event({ matchId: 'm3', ratingAfter: 1548, won: false }),
    ]
    const h = playerHistory(events, [row({ peak: 9999 })], 'alice')
    expect(h?.peak).toBe(1563)
  })

  it('never anchors peak at the free 1500 start for a player who only declined', () => {
    const events = [
      event({ matchId: 'm1', ratingAfter: 1478, won: false }),
      event({ matchId: 'm2', ratingAfter: 1461, won: false }),
    ]
    const h = playerHistory(events, [row()], 'alice')
    expect(h?.peak).toBe(1478)
  })

  it('gives the leader percentile 1 and the last place percentile 0', () => {
    const rows = [
      row({ rank: 1 }),
      row({ key: 'bob', name: 'Bob', rank: 2 }),
      row({ key: 'carol', name: 'Carol', rank: 3 }),
    ]
    expect(playerHistory([event()], rows, 'alice')?.percentile).toBe(1)
    expect(
      playerHistory([event({ key: 'carol', name: 'Carol' })], rows, 'carol')?.percentile,
    ).toBe(0)
  })

  it('gives the middle of three players percentile 0.5', () => {
    const rows = [
      row({ key: 'bob', name: 'Bob', rank: 1 }),
      row({ rank: 2 }),
      row({ key: 'carol', name: 'Carol', rank: 3 }),
    ]
    expect(playerHistory([event()], rows, 'alice')?.percentile).toBe(0.5)
  })

  it('gives a lone ranked player percentile 1', () => {
    expect(playerHistory([event()], [row()], 'alice')?.percentile).toBe(1)
  })
})

describe('perDayPoints', () => {
  it('keeps the null anchor and collapses same-day matches to the end-of-day rating', () => {
    const points = [
      { at: null, rating: 1500 },
      { at: '2026-07-01T09:00:00Z', rating: 1512 },
      { at: '2026-07-01T15:00:00Z', rating: 1505 },
      { at: '2026-07-01T20:00:00Z', rating: 1523 },
    ]
    expect(perDayPoints(points)).toEqual([
      { at: null, rating: 1500 },
      { at: '2026-07-01T20:00:00Z', rating: 1523 },
    ])
  })

  it('keeps one end-of-day point per day, in chronological order', () => {
    const points = [
      { at: null, rating: 1500 },
      { at: '2026-07-01T09:00:00Z', rating: 1512 },
      { at: '2026-07-01T20:00:00Z', rating: 1520 },
      { at: '2026-07-02T10:00:00Z', rating: 1498 },
      { at: '2026-07-03T10:00:00Z', rating: 1533 },
      { at: '2026-07-03T18:00:00Z', rating: 1541 },
    ]
    expect(perDayPoints(points)).toEqual([
      { at: null, rating: 1500 },
      { at: '2026-07-01T20:00:00Z', rating: 1520 },
      { at: '2026-07-02T10:00:00Z', rating: 1498 },
      { at: '2026-07-03T18:00:00Z', rating: 1541 },
    ])
  })

  it('drops the match behind a day point — it stands for the whole day', () => {
    const points = [
      { at: null, rating: 1500 },
      {
        at: '2026-07-01T09:00:00Z',
        rating: 1512,
        match: { opponent: 'Bob', scoreFor: 11, scoreAgainst: 5, won: true },
      },
      {
        at: '2026-07-01T20:00:00Z',
        rating: 1523,
        match: { opponent: 'Carol', scoreFor: 11, scoreAgainst: 8, won: true },
      },
    ]
    expect(perDayPoints(points)).toEqual([
      { at: null, rating: 1500 },
      { at: '2026-07-01T20:00:00Z', rating: 1523 },
    ])
  })

  it('leaves an already one-per-day history unchanged', () => {
    const points = [
      { at: null, rating: 1500 },
      { at: '2026-07-01T10:00:00Z', rating: 1512 },
      { at: '2026-07-02T10:00:00Z', rating: 1498 },
    ]
    expect(perDayPoints(points)).toEqual(points)
  })
})
