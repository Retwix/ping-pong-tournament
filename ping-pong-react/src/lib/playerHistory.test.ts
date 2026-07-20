import { describe, expect, it } from 'vitest'
import { playerHistory } from './playerHistory'
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
    expect(h?.points).toEqual([
      { at: null, rating: 1500 },
      { at: '2026-07-01T10:00:00Z', rating: 1512 },
      { at: '2026-07-02T10:00:00Z', rating: 1498 },
      { at: '2026-07-03T10:00:00Z', rating: 1520 },
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

  it('reads peak, rank and total from the ranked rows', () => {
    const rows = [
      row({ key: 'bob', name: 'Bob', rank: 1 }),
      row({ rank: 2, peak: 1540 }),
      row({ key: 'carol', name: 'Carol', rank: 3 }),
    ]
    const h = playerHistory([event()], rows, 'alice')
    expect(h?.peak).toBe(1540)
    expect(h?.rank).toBe(2)
    expect(h?.total).toBe(3)
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
