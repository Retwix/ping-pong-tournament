import { describe, expect, it } from 'vitest'
import type { RatingEvent, RatingRow } from './rating'
import type { Player } from '../types'
import {
  avatarAction,
  avatarZoom,
  dialogTitle,
  filterJoueurs,
  joueurRows,
  joueursSubtitle,
  normalizeJoueurForm,
  photoShown,
  teamChips,
  type JoueurRow,
  type PhotoDraft,
} from './joueurs'

const getMockPlayer = (overrides?: Partial<Player>): Player => ({
  id: 'p1',
  created_at: '2026-07-01T09:00:00.000Z',
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
  key: 'p1',
  playerId: 'p1',
  name: 'Léo',
  opponentKey: 'p2',
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
  id: 'p1',
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
  status: 'active',
  leftAt: null,
  ...overrides,
})

describe('joueurRows', () => {
  it('shows the registry identity (name, team, photo) with the rounded rating of the matched row', () => {
    const rows = joueurRows(
      [getMockPlayer({ name: 'Léo R.', avatar_url: 'https://cdn/x.webp?v=1' })],
      [getMockRatingRow({ rating: 1442.6, name: 'Léo' })],
      [],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 'p1',
      name: 'Léo R.',
      team: 'tech',
      avatarUrl: 'https://cdn/x.webp?v=1',
      elo: 1443,
    })
  })

  it('rounds Elo down when the fraction is below one half', () => {
    const rows = joueurRows([getMockPlayer()], [getMockRatingRow({ rating: 1487.4 })], [])
    expect(rows[0].elo).toBe(1487)
  })

  it('gives a registered player with no rated game the starting 1500 and an empty record', () => {
    const rows = joueurRows([getMockPlayer()], [], [])
    expect(rows[0]).toMatchObject({
      elo: 1500,
      played: 0,
      meta: '0 V · 0 D',
      matchsLabel: '0 match',
      winrate: '0 %',
      winrateStrong: false,
    })
  })

  it('falls back to matching a rating row recorded by name only', () => {
    const rows = joueurRows(
      [getMockPlayer({ id: 'p9', name: 'Candice' })],
      [getMockRatingRow({ key: 'name:Candice', playerId: null, name: 'Candice', rating: 1398 })],
      [wonEvent('name:Candice', 'm1')],
    )
    expect(rows[0]).toMatchObject({ elo: 1398, played: 1, meta: '1 V · 0 D' })
  })

  it('never matches another registered player’s rating row', () => {
    const rows = joueurRows(
      [getMockPlayer({ id: 'p9', name: 'Candice' })],
      [getMockRatingRow({ key: 'p1', playerId: 'p1', name: 'Léo' })],
      [],
    )
    expect(rows[0].elo).toBe(1500)
  })

  it('never claims a homonym row already owned by another player id', () => {
    const rows = joueurRows(
      [getMockPlayer({ id: 'p9', name: 'Candice' })],
      [getMockRatingRow({ key: 'p1', playerId: 'p1', name: 'Candice' })],
      [],
    )
    expect(rows[0].elo).toBe(1500)
  })

  it('never claims an unowned row recorded under a different name', () => {
    const rows = joueurRows(
      [getMockPlayer({ id: 'p9', name: 'Candice' })],
      [getMockRatingRow({ key: 'name:Léo', playerId: null, name: 'Léo' })],
      [],
    )
    expect(rows[0].elo).toBe(1500)
  })

  it('counts only this player’s events for the V · D record and match count', () => {
    const events = [
      wonEvent('p1', 'm1'),
      wonEvent('p1', 'm2'),
      lostEvent('p1', 'm3'),
      wonEvent('p:other', 'm4'),
    ]
    const rows = joueurRows([getMockPlayer()], [getMockRatingRow()], events)
    expect(rows[0]).toMatchObject({
      played: 3,
      wins: 2,
      losses: 1,
      meta: '2 V · 1 D',
      matchsLabel: '3 matchs',
    })
  })

  it('rounds the win rate to the nearest percent', () => {
    const events = [wonEvent('p1', 'm1'), wonEvent('p1', 'm2'), lostEvent('p1', 'm3')]
    const rows = joueurRows([getMockPlayer()], [getMockRatingRow()], events)
    expect(rows[0].winrate).toBe('67 %')
  })

  it('marks a win rate of exactly 50 % as strong', () => {
    const events = [wonEvent('p1', 'm1'), lostEvent('p1', 'm2')]
    const rows = joueurRows([getMockPlayer()], [getMockRatingRow()], events)
    expect(rows[0]).toMatchObject({ winrate: '50 %', winrateStrong: true })
  })

  it('marks a win rate below 50 % as not strong', () => {
    const events = [wonEvent('p1', 'm1'), lostEvent('p1', 'm2'), lostEvent('p1', 'm3')]
    const rows = joueurRows([getMockPlayer()], [getMockRatingRow()], events)
    expect(rows[0]).toMatchObject({ winrate: '33 %', winrateStrong: false })
  })

  it('uses the singular « match » for exactly one match', () => {
    const rows = joueurRows([getMockPlayer()], [getMockRatingRow()], [wonEvent('p1', 'm1')])
    expect(rows[0].matchsLabel).toBe('1 match')
  })

  it('uses the plural « matchs » from exactly two matches', () => {
    const rows = joueurRows(
      [getMockPlayer()],
      [getMockRatingRow()],
      [wonEvent('p1', 'm1'), lostEvent('p1', 'm2')],
    )
    expect(rows[0].matchsLabel).toBe('2 matchs')
  })

  it('orders by Elo, best first', () => {
    const rows = joueurRows(
      [getMockPlayer({ id: 'p1', name: 'Léo' }), getMockPlayer({ id: 'p2', name: 'Thibault' })],
      [
        getMockRatingRow({ key: 'p1', playerId: 'p1', rating: 1360 }),
        getMockRatingRow({ key: 'p2', playerId: 'p2', name: 'Thibault', rating: 1442 }),
      ],
      [],
    )
    expect(rows.map((r) => r.name)).toEqual(['Thibault', 'Léo'])
  })

  it('breaks Elo ties alphabetically (French collation)', () => {
    const rows = joueurRows(
      [getMockPlayer({ id: 'p1', name: 'Zoé' }), getMockPlayer({ id: 'p2', name: 'Émile' })],
      [],
      [],
    )
    expect(rows.map((r) => r.name)).toEqual(['Émile', 'Zoé'])
  })

  it('carries the registry status and departure date through as status and leftAt', () => {
    const rows = joueurRows(
      [getMockPlayer({ status: 'alumni', left_at: '2026-06-15' })],
      [getMockRatingRow()],
      [],
    )
    expect(rows[0]).toMatchObject({ status: 'alumni', leftAt: '2026-06-15' })
  })

  it('defaults an active player to a null leftAt', () => {
    const rows = joueurRows([getMockPlayer()], [getMockRatingRow()], [])
    expect(rows[0]).toMatchObject({ status: 'active', leftAt: null })
  })

  it('sorts every alumnus below every active player regardless of Elo', () => {
    const rows = joueurRows(
      [
        getMockPlayer({ id: 'p1', name: 'Paul', status: 'alumni', left_at: '2026-06-01' }),
        getMockPlayer({ id: 'p2', name: 'Léo' }),
      ],
      [
        getMockRatingRow({ key: 'p1', playerId: 'p1', rating: 1700 }),
        getMockRatingRow({ key: 'p2', playerId: 'p2', rating: 1200 }),
      ],
      [],
    )
    expect(rows.map((r) => r.name)).toEqual(['Léo', 'Paul'])
  })
})

describe('joueursSubtitle', () => {
  it('announces the head-count with the edit-in-one-click tagline', () => {
    expect(joueursSubtitle(7)).toBe('7 joueurs inscrits · modifie un profil en un clic')
  })

  it('uses the singular below two players', () => {
    expect(joueursSubtitle(1)).toBe('1 joueur inscrit · modifie un profil en un clic')
    expect(joueursSubtitle(0)).toBe('0 joueur inscrit · modifie un profil en un clic')
  })

  it('switches to the plural at exactly two players', () => {
    expect(joueursSubtitle(2)).toBe('2 joueurs inscrits · modifie un profil en un clic')
  })
})

describe('filterJoueurs', () => {
  const annuaire = [
    getMockJoueurRow({ id: 'p1', name: 'Léo', team: 'tech' }),
    getMockJoueurRow({ id: 'p2', name: 'Candice', team: 'support' }),
    getMockJoueurRow({ id: 'p3', name: 'Sam', team: '' }),
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

  it('never matches an empty team through the query', () => {
    expect(filterJoueurs(annuaire, 'sam', 'all').map((r) => r.name)).toEqual(['Sam'])
    expect(filterJoueurs(annuaire, 'tech', 'all').map((r) => r.name)).toEqual(['Léo'])
  })

  it('excludes alumni from « Tous » and from every ordinary team filter', () => {
    const withAlumnus = [
      ...annuaire,
      getMockJoueurRow({ id: 'p4', name: 'Paul', team: 'tech', status: 'alumni' }),
    ]
    expect(filterJoueurs(withAlumnus, '', 'all').map((r) => r.name)).not.toContain('Paul')
    expect(filterJoueurs(withAlumnus, '', 'tech').map((r) => r.name)).not.toContain('Paul')
  })

  it('shows only alumni when the Anciens filter is selected', () => {
    const withAlumnus = [
      ...annuaire,
      getMockJoueurRow({ id: 'p4', name: 'Paul', team: 'tech', status: 'alumni' }),
    ]
    expect(filterJoueurs(withAlumnus, '', 'alumni').map((r) => r.name)).toEqual(['Paul'])
  })
})

describe('normalizeJoueurForm', () => {
  it('trims the name and team before saving', () => {
    expect(normalizeJoueurForm({ name: '  Léo  ', team: ' tech ' })).toEqual({
      name: 'Léo',
      team: 'tech',
    })
  })

  it('saves an empty or whitespace-only name as « Sans nom »', () => {
    expect(normalizeJoueurForm({ name: '', team: 'tech' }).name).toBe('Sans nom')
    expect(normalizeJoueurForm({ name: '   ', team: 'tech' }).name).toBe('Sans nom')
  })

  it('saves an empty or whitespace-only team as « — »', () => {
    expect(normalizeJoueurForm({ name: 'Léo', team: '' }).team).toBe('—')
    expect(normalizeJoueurForm({ name: 'Léo', team: '   ' }).team).toBe('—')
  })
})

describe('dialogTitle', () => {
  it('titles a pending creation « Nouveau joueur »', () => {
    expect(dialogTitle(true, 'Léo')).toBe('Nouveau joueur')
  })

  it('titles an edit with the live form name', () => {
    expect(dialogTitle(false, 'Léo')).toBe('Modifier Léo')
  })

  it('falls back to « le joueur » while the name field is empty', () => {
    expect(dialogTitle(false, '')).toBe('Modifier le joueur')
    expect(dialogTitle(false, '   ')).toBe('Modifier le joueur')
  })
})

const newDraft = (): PhotoDraft => ({
  kind: 'new',
  blob: new Blob(['x'], { type: 'image/webp' }),
  previewUrl: 'blob:preview-1',
})

describe('avatarAction', () => {
  it('does nothing when the photo is untouched', () => {
    expect(avatarAction('https://cdn/x.webp', { kind: 'keep' })).toBe('none')
    expect(avatarAction(null, { kind: 'keep' })).toBe('none')
  })

  it('uploads when a new photo was picked, with or without a previous one', () => {
    expect(avatarAction('https://cdn/x.webp', newDraft())).toBe('upload')
    expect(avatarAction(null, newDraft())).toBe('upload')
  })

  it('removes only when there was a stored photo to remove', () => {
    expect(avatarAction('https://cdn/x.webp', { kind: 'remove' })).toBe('remove')
    expect(avatarAction(null, { kind: 'remove' })).toBe('none')
  })
})

describe('photoShown', () => {
  it('shows the stored photo while untouched', () => {
    expect(photoShown('https://cdn/x.webp', { kind: 'keep' })).toBe('https://cdn/x.webp')
    expect(photoShown(null, { kind: 'keep' })).toBeNull()
  })

  it('shows the local preview of a newly picked photo', () => {
    expect(photoShown('https://cdn/x.webp', newDraft())).toBe('blob:preview-1')
  })

  it('falls back to initials as soon as « Retirer » is clicked', () => {
    expect(photoShown('https://cdn/x.webp', { kind: 'remove' })).toBeNull()
  })
})

describe('avatarZoom', () => {
  it('opens the uploaded photo full size, labelled with the player name', () => {
    const row = getMockJoueurRow({ name: 'Léo', avatarUrl: 'https://cdn/leo.webp' })
    expect(avatarZoom(row)).toEqual({ url: 'https://cdn/leo.webp', alt: 'Photo de Léo' })
  })

  it('has nothing to zoom when the row falls back to initials', () => {
    expect(avatarZoom(getMockJoueurRow({ avatarUrl: null }))).toBeNull()
  })
})

describe('teamChips', () => {
  it('starts with « Tous » carrying the total head-count', () => {
    const chips = teamChips([getMockJoueurRow(), getMockJoueurRow({ id: 'p2', team: '' })])
    expect(chips[0]).toEqual({ key: 'all', label: 'Tous', count: 2 })
  })

  it('lists every standard pôle in registry order with its count, including empty ones', () => {
    const chips = teamChips([
      getMockJoueurRow({ id: 'p1', team: 'tech' }),
      getMockJoueurRow({ id: 'p2', team: 'tech' }),
      getMockJoueurRow({ id: 'p3', team: 'sales' }),
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
      getMockJoueurRow({ id: 'p1', team: 'Légal' }),
      getMockJoueurRow({ id: 'p2', team: 'Légal' }),
      getMockJoueurRow({ id: 'p3', team: 'tech' }),
    ])
    expect(chips[chips.length - 1]).toEqual({ key: 'Légal', label: 'Légal', count: 2 })
    expect(chips.filter((c) => c.key === 'Légal')).toHaveLength(1)
  })

  it('keeps one chip per distinct free-text team, in first-appearance order', () => {
    const chips = teamChips([
      getMockJoueurRow({ id: 'p1', team: 'Légal' }),
      getMockJoueurRow({ id: 'p2', team: 'Ops' }),
      getMockJoueurRow({ id: 'p3', team: 'Légal' }),
    ])
    expect(chips.slice(-2)).toEqual([
      { key: 'Légal', label: 'Légal', count: 2 },
      { key: 'Ops', label: 'Ops', count: 1 },
    ])
  })

  it('does not create a chip for players without a team', () => {
    const chips = teamChips([getMockJoueurRow({ team: '' })])
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

  it('appends an Anciens chip with the alumni count when someone has left', () => {
    const chips = teamChips([
      getMockJoueurRow({ id: 'p1', team: 'tech' }),
      getMockJoueurRow({ id: 'p2', team: 'tech', status: 'alumni' }),
      getMockJoueurRow({ id: 'p3', team: 'sales', status: 'alumni' }),
    ])
    expect(chips[chips.length - 1]).toEqual({ key: 'alumni', label: 'Anciens', count: 2 })
  })

  it('omits the Anciens chip entirely when nobody has left', () => {
    const chips = teamChips([getMockJoueurRow({ id: 'p1' }), getMockJoueurRow({ id: 'p2' })])
    expect(chips.map((c) => c.key)).not.toContain('alumni')
  })
})
