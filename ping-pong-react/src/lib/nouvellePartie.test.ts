import { describe, expect, it } from 'vitest'
import { filterJoueurs, pointsCible, recapitulatif, type CreationState } from './nouvellePartie'

const getState = (overrides?: Partial<CreationState>): CreationState => ({
  variant: 'game',
  format: 'round_robin',
  selected: [],
  name: '',
  target: 11,
  ...overrides,
})

const getJoueur = (overrides?: Partial<{ name: string; team: string }>) => ({
  name: 'Test Joueur',
  team: 'tech',
  ...overrides,
})

describe('récapitulatif — partie rapide', () => {
  it('shows the resting name and asks for 2 players when nobody is picked', () => {
    expect(recapitulatif(getState())).toEqual({
      autoName: 'Partie rapide',
      hint: 'Choisis 2 joueurs.',
      valid: false,
    })
  })

  it('previews the first player against an ellipsis when one is picked', () => {
    expect(recapitulatif(getState({ selected: ['Léo'] }))).toEqual({
      autoName: 'Léo vs …',
      hint: 'Choisis 2 joueurs.',
      valid: false,
    })
  })

  it('names the matchup and echoes the target once both players are picked', () => {
    expect(recapitulatif(getState({ selected: ['Léo', 'Thibault'] }))).toEqual({
      autoName: 'Léo vs Thibault',
      hint: 'Léo vs Thibault · jeu en 11',
      valid: true,
    })
  })

  it('reflects a custom points target in the hint', () => {
    const result = recapitulatif(getState({ selected: ['Léo', 'Thibault'], target: 21 }))
    expect(result.hint).toBe('Léo vs Thibault · jeu en 21')
  })

  it('requires exactly 2 players — a third invalidates the game', () => {
    const result = recapitulatif(getState({ selected: ['Léo', 'Thibault', 'Inès'] }))
    expect(result.valid).toBe(false)
  })
})

describe('récapitulatif — tournoi round-robin', () => {
  const tournoi = (overrides?: Partial<CreationState>): CreationState =>
    getState({ variant: 'tournament', format: 'round_robin', ...overrides })

  it('asks for at least 2 players below the minimum', () => {
    expect(recapitulatif(tournoi({ selected: ['Léo'] }))).toEqual({
      autoName: 'Tournoi',
      hint: 'Sélectionne au moins 2 joueurs.',
      valid: false,
    })
  })

  it('is valid from exactly 2 players with 1 match and 1 round', () => {
    expect(recapitulatif(tournoi({ selected: ['Léo', 'Thibault'] }))).toEqual({
      autoName: 'Tournoi',
      hint: '2 joueurs · 1 matchs · 1 tours',
      valid: true,
    })
  })

  it('counts matches and rounds for an even field without exempts', () => {
    const result = recapitulatif(tournoi({ selected: ['A', 'B', 'C', 'D'] }))
    expect(result.hint).toBe('4 joueurs · 6 matchs · 3 tours')
  })

  it('flags exempts for an odd field', () => {
    const result = recapitulatif(tournoi({ selected: ['A', 'B', 'C', 'D', 'E'] }))
    expect(result.hint).toBe('5 joueurs · 10 matchs · 5 tours (avec exempts)')
  })

  it('uses the trimmed tournament name when one is typed', () => {
    const result = recapitulatif(tournoi({ selected: ['A', 'B'], name: '  Tournoi du bureau  ' }))
    expect(result.autoName).toBe('Tournoi du bureau')
  })

  it('falls back to « Tournoi » when the name is only whitespace', () => {
    const result = recapitulatif(tournoi({ selected: ['A', 'B'], name: '   ' }))
    expect(result.autoName).toBe('Tournoi')
  })
})

describe('récapitulatif — tournoi élimination directe', () => {
  const elim = (overrides?: Partial<CreationState>): CreationState =>
    getState({ variant: 'tournament', format: 'double_elim', ...overrides })

  it('asks for at least 3 players below the minimum', () => {
    expect(recapitulatif(elim({ selected: ['Léo', 'Thibault'] }))).toEqual({
      autoName: 'Tournoi',
      hint: 'Sélectionne au moins 3 joueurs pour une élimination directe.',
      valid: false,
    })
  })

  it('is valid from exactly 3 players with the double-elim match count', () => {
    expect(recapitulatif(elim({ selected: ['A', 'B', 'C'] }))).toEqual({
      autoName: 'Tournoi',
      hint: '3 joueurs · 4 matchs · 2 défaites = éliminé',
      valid: true,
    })
  })

  it('counts matches for a larger bracket', () => {
    const result = recapitulatif(elim({ selected: ['A', 'B', 'C', 'D', 'E', 'F'] }))
    expect(result.hint).toBe('6 joueurs · 10 matchs · 2 défaites = éliminé')
  })
})

describe('pointsCible', () => {
  it('uses the preset while « autre » is empty', () => {
    expect(pointsCible(11, '')).toBe(11)
  })

  it('prefers a valid « autre » value over the preset', () => {
    expect(pointsCible(11, '15')).toBe(15)
  })

  it('accepts the 1 and 99 boundaries', () => {
    expect(pointsCible(11, '1')).toBe(1)
    expect(pointsCible(11, '99')).toBe(99)
  })

  it('falls back to the preset outside 1–99', () => {
    expect(pointsCible(11, '0')).toBe(11)
    expect(pointsCible(21, '100')).toBe(21)
  })

  it('falls back to the preset for non-numeric input', () => {
    expect(pointsCible(21, 'abc')).toBe(21)
  })

  it('tolerates surrounding whitespace', () => {
    expect(pointsCible(11, ' 21 ')).toBe(21)
  })
})

describe('filterJoueurs', () => {
  const registry = [
    getJoueur({ name: 'Léo', team: 'tech' }),
    getJoueur({ name: 'Thibault', team: 'support' }),
    getJoueur({ name: 'Inès', team: 'marketing' }),
  ]

  it('returns the registry untouched (same array) for an empty query', () => {
    expect(filterJoueurs(registry, '')).toBe(registry)
  })

  it('returns the registry untouched (same array) for a whitespace-only query', () => {
    expect(filterJoueurs(registry, '   ')).toBe(registry)
  })

  it('matches a plain query against an accented name', () => {
    expect(filterJoueurs(registry, 'leo')).toEqual([registry[0]])
  })

  it('matches an accented query against a plain name', () => {
    expect(filterJoueurs(registry, 'thîbault')).toEqual([registry[1]])
  })

  it('is case-insensitive and matches inside the name', () => {
    expect(filterJoueurs(registry, 'BAU')).toEqual([registry[1]])
  })

  it('matches on the pôle label, not just the name', () => {
    expect(filterJoueurs(registry, 'customer')).toEqual([registry[1]])
  })

  it('returns nothing when neither names nor pôles match', () => {
    expect(filterJoueurs(registry, 'zzz')).toEqual([])
  })
})
