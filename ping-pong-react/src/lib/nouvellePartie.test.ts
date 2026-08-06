import { describe, expect, it } from 'vitest'
import {
  aideCamp,
  choisirJoueurDouble,
  estDoublon,
  recapitulatifHasard,
  filterJoueurs,
  noteEnjeu,
  pointsCible,
  recapitulatif,
  recapitulatifDouble,
  retirerJoueurDouble,
  type CreationState,
  type SelectionDouble,
} from './nouvellePartie'

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

describe('estDoublon', () => {
  const registry = [getJoueur({ name: 'Léo' }), getJoueur({ name: 'Thibault' })]

  it('flags an exact existing name', () => {
    expect(estDoublon(registry, 'Léo')).toBe(true)
  })

  it('flags a case-insensitive match', () => {
    expect(estDoublon(registry, 'THIBAULT')).toBe(true)
  })

  it('flags an accent-insensitive match', () => {
    expect(estDoublon(registry, 'Leo')).toBe(true)
  })

  it('ignores surrounding whitespace', () => {
    expect(estDoublon(registry, '  Léo  ')).toBe(true)
  })

  it('lets a genuinely new name through', () => {
    expect(estDoublon(registry, 'Inès')).toBe(false)
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

describe('noteEnjeu', () => {
  it('explains that a ranked game moves Elo and counts in the classement', () => {
    expect(noteEnjeu(false)).toBe(
      'Le résultat déplace l’Elo des joueurs et compte dans « Le classement ».',
    )
  })

  it('explains that an unranked game touches no Elo but stays visible', () => {
    expect(noteEnjeu(true)).toBe(
      'Aucun impact sur le classement Elo. La partie reste visible dans les parties.',
    )
  })

  it('explains the v1 doubles lock for a 2v2 game', () => {
    expect(noteEnjeu(true, true)).toBe(
      'Les doubles sont non classés en v1 — pas encore d’Elo de paire.',
    )
  })

  it('lets the doubles lock override a ranked enjeu', () => {
    expect(noteEnjeu(false, true)).toBe(
      'Les doubles sont non classés en v1 — pas encore d’Elo de paire.',
    )
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

const getSelDouble = (overrides?: Partial<SelectionDouble>): SelectionDouble => ({
  a: [],
  b: [],
  camp: 'A',
  ...overrides,
})

describe('choisirJoueurDouble', () => {
  it('sends the first pick to équipe A and keeps A active', () => {
    expect(choisirJoueurDouble(getSelDouble(), 'Léo')).toEqual({
      a: ['Léo'],
      b: [],
      camp: 'A',
    })
  })

  it('auto-switches the active camp to B once A is full', () => {
    const sel = getSelDouble({ a: ['Léo'] })
    expect(choisirJoueurDouble(sel, 'Inès')).toEqual({
      a: ['Léo', 'Inès'],
      b: [],
      camp: 'B',
    })
  })

  it('fills a manually chosen camp B and stays there while it has room', () => {
    expect(choisirJoueurDouble(getSelDouble({ camp: 'B' }), 'Karim')).toEqual({
      a: [],
      b: ['Karim'],
      camp: 'B',
    })
  })

  it('switches back to A once a B-first camp is full', () => {
    const sel = getSelDouble({ b: ['Karim'], camp: 'B' })
    expect(choisirJoueurDouble(sel, 'Julie')).toEqual({
      a: [],
      b: ['Karim', 'Julie'],
      camp: 'A',
    })
  })

  it('overflows to the other camp when the active one is already full', () => {
    const sel = getSelDouble({ a: ['Léo', 'Inès'], camp: 'A' })
    expect(choisirJoueurDouble(sel, 'Karim')).toEqual({
      a: ['Léo', 'Inès'],
      b: ['Karim'],
      camp: 'B',
    })
  })

  it('keeps the camp on the team just completed by the fourth pick', () => {
    const sel = getSelDouble({ a: ['Léo', 'Inès'], b: ['Karim'], camp: 'B' })
    expect(choisirJoueurDouble(sel, 'Julie')).toEqual({
      a: ['Léo', 'Inès'],
      b: ['Karim', 'Julie'],
      camp: 'B',
    })
  })

  it('ignores a fifth pick when both teams are full', () => {
    const sel = getSelDouble({ a: ['Léo', 'Inès'], b: ['Karim', 'Julie'], camp: 'B' })
    expect(choisirJoueurDouble(sel, 'Zoé')).toEqual(sel)
  })

  it('ignores a player already picked in équipe A', () => {
    const sel = getSelDouble({ a: ['Léo'], b: ['Karim'], camp: 'B' })
    expect(choisirJoueurDouble(sel, 'Léo')).toEqual(sel)
  })

  it('ignores a player already picked in équipe B', () => {
    const sel = getSelDouble({ a: ['Léo'], b: ['Karim'], camp: 'A' })
    expect(choisirJoueurDouble(sel, 'Karim')).toEqual(sel)
  })

  it('does not mutate the incoming selection', () => {
    const sel = getSelDouble({ a: ['Léo'] })
    choisirJoueurDouble(sel, 'Inès')
    expect(sel).toEqual(getSelDouble({ a: ['Léo'] }))
  })
})

describe('retirerJoueurDouble', () => {
  it('removes a player from équipe A without touching the active camp', () => {
    const sel = getSelDouble({ a: ['Léo', 'Inès'], b: ['Karim'], camp: 'B' })
    expect(retirerJoueurDouble(sel, 'Léo')).toEqual({
      a: ['Inès'],
      b: ['Karim'],
      camp: 'B',
    })
  })

  it('removes a player from équipe B', () => {
    const sel = getSelDouble({ a: ['Léo'], b: ['Karim', 'Julie'], camp: 'A' })
    expect(retirerJoueurDouble(sel, 'Julie')).toEqual({
      a: ['Léo'],
      b: ['Karim'],
      camp: 'A',
    })
  })

  it('leaves the selection untouched for an unknown name', () => {
    const sel = getSelDouble({ a: ['Léo'], b: ['Karim'], camp: 'B' })
    expect(retirerJoueurDouble(sel, 'Zoé')).toEqual(sel)
  })

  it('does not mutate the incoming selection', () => {
    const sel = getSelDouble({ a: ['Léo', 'Inès'] })
    retirerJoueurDouble(sel, 'Léo')
    expect(sel).toEqual(getSelDouble({ a: ['Léo', 'Inès'] }))
  })
})

describe('récapitulatif — équipes au hasard', () => {
  it('asks for 4 players and shows the count while nobody is picked', () => {
    expect(recapitulatifHasard(0, 11)).toEqual({
      autoName: 'Partie en double',
      hint: 'Choisis 4 joueurs — les équipes seront tirées au sort. Joueurs : 0/4.',
      valid: false,
    })
  })

  it('counts the picked players in the hint', () => {
    expect(recapitulatifHasard(2, 11).hint).toBe(
      'Choisis 4 joueurs — les équipes seront tirées au sort. Joueurs : 2/4.',
    )
  })

  it('stays invalid at 3 players', () => {
    expect(recapitulatifHasard(3, 11).valid).toBe(false)
  })

  it('validates at exactly 4 players and echoes the target', () => {
    expect(recapitulatifHasard(4, 21)).toEqual({
      autoName: 'Partie en double',
      hint: '4 joueurs · équipes au hasard · jeu en 21',
      valid: true,
    })
  })

  it('rejects an overfull selection defensively', () => {
    expect(recapitulatifHasard(5, 11).valid).toBe(false)
  })
})

describe('aideCamp', () => {
  it('points picks at équipe A while the game is incomplete', () => {
    expect(aideCamp(getSelDouble())).toBe(
      'Les joueurs choisis rejoignent l’équipe A — clique l’autre carte pour changer de camp.',
    )
  })

  it('points picks at équipe B after a camp switch', () => {
    expect(aideCamp(getSelDouble({ a: ['Léo', 'Inès'], b: ['Karim'], camp: 'B' }))).toBe(
      'Les joueurs choisis rejoignent l’équipe B — clique l’autre carte pour changer de camp.',
    )
  })

  it('announces completeness once 4 players are picked', () => {
    expect(aideCamp(getSelDouble({ a: ['Léo', 'Inès'], b: ['Karim', 'Julie'] }))).toBe(
      'Les deux équipes sont complètes.',
    )
  })
})

describe('récapitulatif — partie en double', () => {
  it('shows ellipsis placeholders and 0/2 counters when nobody is picked', () => {
    expect(recapitulatifDouble(getSelDouble(), 11)).toEqual({
      autoName: '… vs …',
      hint: 'Choisis 4 joueurs — 2 par équipe. Équipe A : 0/2 · Équipe B : 0/2.',
      valid: false,
    })
  })

  it('previews a lone équipe A player against an ellipsis', () => {
    expect(recapitulatifDouble(getSelDouble({ a: ['Léo'] }), 11)).toEqual({
      autoName: 'Léo vs …',
      hint: 'Choisis 4 joueurs — 2 par équipe. Équipe A : 1/2 · Équipe B : 0/2.',
      valid: false,
    })
  })

  it('joins a full pair with « & » while the other team is incomplete', () => {
    const sel = getSelDouble({ a: ['Léo', 'Inès'], b: ['Karim'] })
    expect(recapitulatifDouble(sel, 11)).toEqual({
      autoName: 'Léo & Inès vs Karim',
      hint: 'Choisis 4 joueurs — 2 par équipe. Équipe A : 2/2 · Équipe B : 1/2.',
      valid: false,
    })
  })

  it('names the full matchup and echoes the target once both pairs are complete', () => {
    const sel = getSelDouble({ a: ['Léo', 'Inès'], b: ['Karim', 'Julie'] })
    expect(recapitulatifDouble(sel, 11)).toEqual({
      autoName: 'Léo & Inès vs Karim & Julie',
      hint: 'Léo & Inès vs Karim & Julie · jeu en 11',
      valid: true,
    })
  })

  it('reflects a custom points target in the hint', () => {
    const sel = getSelDouble({ a: ['Léo', 'Inès'], b: ['Karim', 'Julie'] })
    expect(recapitulatifDouble(sel, 21).hint).toBe('Léo & Inès vs Karim & Julie · jeu en 21')
  })

  it('stays invalid when équipe B is full but équipe A is not', () => {
    const sel = getSelDouble({ a: ['Léo'], b: ['Karim', 'Julie'] })
    expect(recapitulatifDouble(sel, 11)).toEqual({
      autoName: 'Léo vs Karim & Julie',
      hint: 'Choisis 4 joueurs — 2 par équipe. Équipe A : 1/2 · Équipe B : 2/2.',
      valid: false,
    })
  })

  it('rejects a player appearing in both teams', () => {
    const sel = getSelDouble({ a: ['Léo', 'Inès'], b: ['Léo', 'Julie'] })
    expect(recapitulatifDouble(sel, 11)).toEqual({
      autoName: 'Léo & Inès vs Léo & Julie',
      hint: 'Choisis 4 joueurs — 2 par équipe. Équipe A : 2/2 · Équipe B : 2/2.',
      valid: false,
    })
  })
})
