import { describe, expect, it } from 'vitest'
import type { RatingEvent, RatingRow } from './rating'
import { filterJoueurs, joueurRows, teamChips, type JoueurRow } from './joueurs'

const getMockRatingRow = (overrides?: Partial<RatingRow>): RatingRow => ({
  key: 'p:leo',
  playerId: 'p1',
  name: 'Léo',
  rating: 1487.4,
  rd: 80,
  vol: 0.06,
  games: 24,
  peak: 1500,
  lastPlayedAt: '2026-07-30T10:00:00.000Z',
  rank: 1,
  provisional: false,
  team: 'tech',
  avatar_url: null,
  trend: 12,
  ...overrides,
})

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

const wonEvent = (key: string, matchId: string): RatingEvent =>
  getMockEvent({ key, matchId, won: true })
const lostEvent = (key: string, matchId: string): RatingEvent =>
  getMockEvent({ key, matchId, won: false })

const getMockJoueurRow = (overrides?: Partial<JoueurRow>): JoueurRow => ({
  key: 'p:leo',
  playerId: 'p1',
  name: 'Léo',
  team: 'tech',
  avatarUrl: null,
  elo: 1487,
  played: 3,
  wins: 2,
  losses: 1,
  meta: '2 V · 1 D',
  matchsLabel: '3 matchs',
  winrate: '67 %',
  winrateStrong: true,
  ...overrides,
})

describe('joueurRows', () => {
  it('maps a rating row to the annuaire row: rounded Elo, identity and avatar passthrough', () => {
    const rows = joueurRows(
      [getMockRatingRow({ rating: 1442.6, avatar_url: 'https://cdn/x.webp?v=1' })],
      [],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      key: 'p:leo',
      playerId: 'p1',
      name: 'Léo',
      team: 'tech',
      avatarUrl: 'https://cdn/x.webp?v=1',
      elo: 1443,
    })
  })

  it('rounds Elo down when the fraction is below one half', () => {
    const rows = joueurRows([getMockRatingRow({ rating: 1487.4 })], [])
    expect(rows[0].elo).toBe(1487)
  })

  it('counts only this player’s events for the V · D record and match count', () => {
    const events = [
      wonEvent('p:leo', 'm1'),
      wonEvent('p:leo', 'm2'),
      lostEvent('p:leo', 'm3'),
      wonEvent('p:other', 'm4'),
    ]
    const rows = joueurRows([getMockRatingRow()], events)
    expect(rows[0]).toMatchObject({
      played: 3,
      wins: 2,
      losses: 1,
      meta: '2 V · 1 D',
      matchsLabel: '3 matchs',
    })
  })

  it('rounds the win rate to the nearest percent', () => {
    const events = [wonEvent('p:leo', 'm1'), wonEvent('p:leo', 'm2'), lostEvent('p:leo', 'm3')]
    const rows = joueurRows([getMockRatingRow()], events)
    expect(rows[0].winrate).toBe('67 %')
  })

  it('marks a win rate of exactly 50 % as strong', () => {
    const events = [wonEvent('p:leo', 'm1'), lostEvent('p:leo', 'm2')]
    const rows = joueurRows([getMockRatingRow()], events)
    expect(rows[0]).toMatchObject({ winrate: '50 %', winrateStrong: true })
  })

  it('marks a win rate below 50 % as not strong', () => {
    const events = [wonEvent('p:leo', 'm1'), lostEvent('p:leo', 'm2'), lostEvent('p:leo', 'm3')]
    const rows = joueurRows([getMockRatingRow()], events)
    expect(rows[0]).toMatchObject({ winrate: '33 %', winrateStrong: false })
  })

  it('gives a player with no rated match a 0 % rate, singular label and empty record', () => {
    const rows = joueurRows([getMockRatingRow()], [])
    expect(rows[0]).toMatchObject({
      played: 0,
      meta: '0 V · 0 D',
      matchsLabel: '0 match',
      winrate: '0 %',
      winrateStrong: false,
    })
  })

  it('uses the singular « match » for exactly one match', () => {
    const rows = joueurRows([getMockRatingRow()], [wonEvent('p:leo', 'm1')])
    expect(rows[0].matchsLabel).toBe('1 match')
  })

  it('uses the plural « matchs » from exactly two matches', () => {
    const rows = joueurRows(
      [getMockRatingRow()],
      [wonEvent('p:leo', 'm1'), lostEvent('p:leo', 'm2')],
    )
    expect(rows[0].matchsLabel).toBe('2 matchs')
  })

  it('keeps the incoming (ranked) order', () => {
    const rows = joueurRows(
      [
        getMockRatingRow({ key: 'p:leo', name: 'Léo' }),
        getMockRatingRow({ key: 'p:thibault', name: 'Thibault', rating: 1442 }),
      ],
      [],
    )
    expect(rows.map((r) => r.name)).toEqual(['Léo', 'Thibault'])
  })
})

describe('filterJoueurs', () => {
  const annuaire = [
    getMockJoueurRow({ key: 'p:leo', name: 'Léo', team: 'tech' }),
    getMockJoueurRow({ key: 'p:candice', name: 'Candice', team: 'support' }),
    getMockJoueurRow({ key: 'p:sam', name: 'Sam', team: null }),
  ]

  it('returns every row for an empty query on « Tous »', () => {
    expect(filterJoueurs(annuaire, '', 'all')).toHaveLength(3)
  })

  it('matches names accent- and case-insensitively', () => {
    expect(filterJoueurs(annuaire, 'leo', 'all').map((r) => r.name)).toEqual(['Léo'])
  })

  it('ignores surrounding whitespace in the query', () => {
    expect(filterJoueurs(annuaire, '  léo  ', 'all').map((r) => r.name)).toEqual(['Léo'])
  })

  it('matches on the team label as well as the name', () => {
    expect(filterJoueurs(annuaire, 'customer', 'all').map((r) => r.name)).toEqual(['Candice'])
  })

  it('keeps only the selected team', () => {
    expect(filterJoueurs(annuaire, '', 'tech').map((r) => r.name)).toEqual(['Léo'])
  })

  it('combines the team filter with the query', () => {
    expect(filterJoueurs(annuaire, 'candice', 'tech')).toEqual([])
  })

  it('returns no rows when nothing matches', () => {
    expect(filterJoueurs(annuaire, 'zzz', 'all')).toEqual([])
  })

  it('never matches a null team through the query', () => {
    expect(filterJoueurs(annuaire, 'sam', 'all').map((r) => r.name)).toEqual(['Sam'])
    expect(filterJoueurs(annuaire, 'tech', 'all').map((r) => r.name)).toEqual(['Léo'])
  })
})

describe('teamChips', () => {
  it('starts with « Tous » carrying the total head-count', () => {
    const chips = teamChips([getMockJoueurRow(), getMockJoueurRow({ key: 'p:2', team: null })])
    expect(chips[0]).toEqual({ key: 'all', label: 'Tous', count: 2 })
  })

  it('lists every standard pôle in registry order with its count, including empty ones', () => {
    const chips = teamChips([
      getMockJoueurRow({ key: 'p:1', team: 'tech' }),
      getMockJoueurRow({ key: 'p:2', team: 'tech' }),
      getMockJoueurRow({ key: 'p:3', team: 'sales' }),
    ])
    expect(chips.slice(1)).toEqual([
      { key: 'tech', label: 'Tech', count: 2 },
      { key: 'support', label: 'Customer Support', count: 0 },
      { key: 'marketing', label: 'Marketing', count: 0 },
      { key: 'sales', label: 'Sales', count: 1 },
      { key: 'business', label: 'Business', count: 0 },
      { key: 'guests', label: 'Guests', count: 0 },
    ])
  })

  it('appends free-text teams after the standard pôles, once, with their count', () => {
    const chips = teamChips([
      getMockJoueurRow({ key: 'p:1', team: 'Légal' }),
      getMockJoueurRow({ key: 'p:2', team: 'Légal' }),
      getMockJoueurRow({ key: 'p:3', team: 'tech' }),
    ])
    expect(chips[chips.length - 1]).toEqual({ key: 'Légal', label: 'Légal', count: 2 })
    expect(chips.filter((c) => c.key === 'Légal')).toHaveLength(1)
  })

  it('keeps one chip per distinct free-text team, in first-appearance order', () => {
    const chips = teamChips([
      getMockJoueurRow({ key: 'p:1', team: 'Légal' }),
      getMockJoueurRow({ key: 'p:2', team: 'Ops' }),
      getMockJoueurRow({ key: 'p:3', team: 'Légal' }),
    ])
    expect(chips.slice(-2)).toEqual([
      { key: 'Légal', label: 'Légal', count: 2 },
      { key: 'Ops', label: 'Ops', count: 1 },
    ])
  })

  it('does not create a chip for players without a team', () => {
    const chips = teamChips([getMockJoueurRow({ team: null })])
    expect(chips.map((c) => c.key)).toEqual([
      'all',
      'tech',
      'support',
      'marketing',
      'sales',
      'business',
      'guests',
    ])
  })
})
