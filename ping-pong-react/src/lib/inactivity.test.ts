import { describe, expect, it } from 'vitest'
import type { Player } from '../types'
import type { RatingRow } from './rating'
import type { Season } from './seasons'
import { ladderSections, splitInactive } from './inactivity'

const getMockPlayer = (overrides?: Partial<Player>): Player => ({
  id: 'p1',
  created_at: '2026-01-01T00:00:00.000Z',
  name: 'Léo',
  team: 'tech',
  slack_user_id: null,
  avatar_url: null,
  status: 'active',
  left_at: null,
  ...overrides,
})

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

const getMockSeason = (overrides?: Partial<Season>): Season => ({
  id: '2026-ete',
  slug: 'ete',
  label: 'Été 2026',
  start: new Date('2026-06-01T00:00:00.000Z'),
  end: new Date('2026-09-01T00:00:00.000Z'),
  year: 2026,
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

  it('keeps a player whose last match carries no date, rather than inventing an absence', () => {
    const now = new Date('2026-08-27T12:00:00.000Z')
    const rows = [getMockRatingRow({ key: 'solenn', name: 'Solenn', lastPlayedAt: null })]

    const { active, inactifs } = splitInactive(rows, now)

    expect(active.map((r) => r.name)).toEqual(['Solenn'])
    expect(inactifs).toEqual([])
  })

  it('lists les inactifs highest rating first, the order the ranked ladder handed over', () => {
    const now = new Date('2026-08-27T12:00:00.000Z')
    const rows = [
      getMockRatingRow({
        key: 'chris',
        name: 'Chris',
        rating: 1674,
        lastPlayedAt: '2026-07-09T12:00:00.000Z',
      }),
      getMockRatingRow({
        key: 'solenn',
        name: 'Solenn',
        rating: 1520,
        lastPlayedAt: '2026-07-17T12:00:00.000Z',
      }),
    ]

    const { inactifs } = splitInactive(rows, now)

    expect(inactifs.map((r) => [r.name, r.rating])).toEqual([
      ['Chris', 1674],
      ['Solenn', 1520],
    ])
  })
})

describe('ladderSections', () => {
  it('leaves a closed season alone — its ladder is frozen history, so nobody is inactif', () => {
    const now = new Date('2026-08-27T12:00:00.000Z')
    const rows = [
      getMockRatingRow({
        key: 'chris',
        name: 'Chris',
        rating: 1674,
        lastPlayedAt: '2026-06-01T12:00:00.000Z',
      }),
      getMockRatingRow({
        key: 'leo',
        name: 'Léo',
        rating: 1565,
        lastPlayedAt: '2026-06-02T12:00:00.000Z',
      }),
    ]

    const { ranked, inactifs } = ladderSections({
      rows,
      players: [],
      season: getMockSeason(),
      now,
      archived: true,
    })

    expect(ranked.map((r) => [r.name, r.rank])).toEqual([
      ['Chris', 1],
      ['Léo', 2],
    ])
    expect(inactifs).toEqual([])
  })

  it('applies the rule on an open season, where the ladder is still live', () => {
    const now = new Date('2026-08-27T12:00:00.000Z')
    const rows = [
      getMockRatingRow({
        key: 'chris',
        name: 'Chris',
        rating: 1674,
        lastPlayedAt: '2026-06-01T12:00:00.000Z',
      }),
      getMockRatingRow({
        key: 'leo',
        name: 'Léo',
        rating: 1565,
        lastPlayedAt: '2026-08-20T12:00:00.000Z',
      }),
    ]

    const { ranked, inactifs } = ladderSections({
      rows,
      players: [],
      season: getMockSeason(),
      now,
      archived: false,
    })

    expect(ranked.map((r) => r.name)).toEqual(['Léo'])
    expect(inactifs.map((r) => r.name)).toEqual(['Chris'])
  })

  it('sends an idle ancien to les anciens, never to les inactifs', () => {
    const now = new Date('2026-08-27T12:00:00.000Z')
    const rows = [
      getMockRatingRow({
        key: 'chris',
        playerId: 'pc',
        name: 'Chris',
        rating: 1674,
        lastPlayedAt: '2026-06-01T12:00:00.000Z',
      }),
      getMockRatingRow({
        key: 'leo',
        playerId: 'pl',
        name: 'Léo',
        rating: 1565,
        lastPlayedAt: '2026-08-20T12:00:00.000Z',
      }),
    ]
    const players = [
      getMockPlayer({ id: 'pc', name: 'Chris', status: 'alumni', left_at: '2026-06-15' }),
      getMockPlayer({ id: 'pl', name: 'Léo' }),
    ]

    const { ranked, anciens, inactifs } = ladderSections({
      rows,
      players,
      season: null,
      now,
      archived: false,
    })

    expect(ranked.map((r) => r.name)).toEqual(['Léo'])
    expect(anciens.map((r) => r.name)).toEqual(['Chris'])
    expect(inactifs).toEqual([])
  })

  it('keeps an ancien ranked in a season they were still around for', () => {
    const now = new Date('2026-08-27T12:00:00.000Z')
    const rows = [
      getMockRatingRow({ key: 'chris', playerId: 'pc', name: 'Chris', rating: 1674 }),
      getMockRatingRow({ key: 'leo', playerId: 'pl', name: 'Léo', rating: 1565 }),
    ]
    const players = [
      getMockPlayer({ id: 'pc', name: 'Chris', status: 'alumni', left_at: '2026-12-01' }),
      getMockPlayer({ id: 'pl', name: 'Léo' }),
    ]

    const { ranked, anciens } = ladderSections({
      rows,
      players,
      season: getMockSeason(),
      now,
      archived: true,
    })

    expect(ranked.map((r) => r.name)).toEqual(['Chris', 'Léo'])
    expect(anciens).toEqual([])
  })
})
