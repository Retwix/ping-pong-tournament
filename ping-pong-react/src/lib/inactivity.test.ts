import { describe, expect, it } from 'vitest'
import type { RatingRow } from './rating'
import { splitInactive } from './inactivity'

const getMockRatingRow = (overrides?: Partial<RatingRow>): RatingRow => ({
  key: 'p1',
  playerId: 'p1',
  name: 'Léo',
  rating: 1500,
  rd: 80,
  vol: 0.06,
  games: 10,
  peak: 1500,
  lastPlayedAt: '2026-07-01T00:00:00.000Z',
  rank: 1,
  provisional: false,
  team: 'tech',
  avatar_url: null,
  trend: 0,
  ...overrides,
})

describe('splitInactive', () => {
  it('drops a player idle for 30 days out of the ranking and keeps one idle for 29', () => {
    const now = new Date('2026-08-27T12:00:00.000Z')
    const rows = [
      getMockRatingRow({
        key: 'chris',
        name: 'Chris',
        lastPlayedAt: '2026-07-28T12:00:00.000Z',
      }),
      getMockRatingRow({
        key: 'leo',
        name: 'Léo',
        lastPlayedAt: '2026-07-29T12:00:00.000Z',
      }),
    ]

    const { active, inactifs } = splitInactive(rows, now)

    expect(active.map((r) => r.name)).toEqual(['Léo'])
    expect(inactifs.map((r) => r.name)).toEqual(['Chris'])
  })

  it('closes the gap in the numbering left by a player who drops out', () => {
    const now = new Date('2026-08-27T12:00:00.000Z')
    const rows = [
      getMockRatingRow({
        key: 'thibault',
        name: 'Thibault',
        rank: 1,
        lastPlayedAt: '2026-08-26T12:00:00.000Z',
      }),
      getMockRatingRow({
        key: 'chris',
        name: 'Chris',
        rank: 2,
        lastPlayedAt: '2026-07-09T12:00:00.000Z',
      }),
      getMockRatingRow({
        key: 'leo',
        name: 'Léo',
        rank: 3,
        lastPlayedAt: '2026-08-26T12:00:00.000Z',
      }),
    ]

    const { active } = splitInactive(rows, now)

    expect(active.map((r) => [r.name, r.rank])).toEqual([
      ['Thibault', 1],
      ['Léo', 2],
    ])
  })

  it('reports whole days away, ignoring the time of day the last match ran', () => {
    const now = new Date('2026-08-27T12:00:00.000Z')
    const rows = [
      getMockRatingRow({
        key: 'chris',
        name: 'Chris',
        lastPlayedAt: '2026-07-25T18:00:00.000Z',
      }),
    ]

    const { inactifs } = splitInactive(rows, now)

    expect(inactifs.map((r) => [r.name, r.daysIdle])).toEqual([['Chris', 32]])
  })
})
