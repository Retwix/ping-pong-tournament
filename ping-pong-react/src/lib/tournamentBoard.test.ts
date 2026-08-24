import { describe, expect, it } from 'vitest'
import { enteteTournoi } from './tournamentBoard'
import type { Tournament } from '../types'

const getMockTournament = (overrides?: Partial<Tournament>): Tournament => ({
  id: 't1',
  created_at: '2026-08-24T09:00:00.000Z',
  name: "Tournoi d'août",
  target: 11,
  players: ['Léo', 'Thibault', 'Inès', 'Candice', 'Marc'],
  status: 'active',
  kind: 'tournament',
  format: 'round_robin',
  champion: null,
  is_active: true,
  slack_channel: null,
  slack_thread_ts: null,
  result_notified: false,
  unranked: false,
  doubles: false,
  teams: null,
  chaos_enabled: false,
  chaos_interval: 2,
  chaos_intensity: 'full',
  chaos_legendary: true,
  ...overrides,
})

describe('enteteTournoi', () => {
  it('names the format, the player count and the target in the kicker', () => {
    const entete = enteteTournoi(getMockTournament())

    expect(entete.kicker).toBe('Round-robin · 5 joueurs · jeu en 11')
  })

  it('uses the app-wide double-elimination label, not the handoff wording', () => {
    const entete = enteteTournoi(
      getMockTournament({
        format: 'double_elim',
        players: ['Léo', 'Thibault', 'Inès', 'Candice', 'Marc', 'Zoé', 'Hugo', 'Nina'],
      }),
    )

    expect(entete.kicker).toBe('Élimination directe · 8 joueurs · jeu en 11')
  })

  it('carries the target through rather than assuming a game in 11', () => {
    const entete = enteteTournoi(getMockTournament({ target: 21 }))

    expect(entete.kicker).toBe('Round-robin · 5 joueurs · jeu en 21')
  })

  it('tells a round-robin player to tap a match to score it', () => {
    const entete = enteteTournoi(getMockTournament())

    expect(entete.sousTitre).toBe(
      'Tape un match pour ouvrir le marqueur. Tout se synchronise en direct.',
    )
  })

  it('explains the losers bracket on a double-elimination tournament', () => {
    const entete = enteteTournoi(getMockTournament({ format: 'double_elim' }))

    expect(entete.sousTitre).toBe(
      'Le gagnant avance, le perdant tombe dans le tableau des perdants. Tape un match prêt pour le marquer.',
    )
  })

  it('warns that an unranked round-robin moves no Elo', () => {
    const entete = enteteTournoi(getMockTournament({ unranked: true }))

    expect(entete.sousTitre).toBe(
      'Tape un match pour ouvrir le marqueur. Tout se synchronise en direct. Aucun impact sur le classement Elo.',
    )
    expect(entete.nonClasse).toBe(true)
  })

  it('warns that an unranked double-elimination tournament moves no Elo', () => {
    const entete = enteteTournoi(getMockTournament({ format: 'double_elim', unranked: true }))

    expect(entete.sousTitre).toBe(
      'Le gagnant avance, le perdant tombe dans le tableau des perdants. Tape un match prêt pour le marquer. Aucun impact sur le classement Elo.',
    )
    expect(entete.nonClasse).toBe(true)
  })

  it('says nothing about Elo on a ranked tournament', () => {
    const entete = enteteTournoi(getMockTournament())

    expect(entete.sousTitre).not.toContain('Elo')
    expect(entete.nonClasse).toBe(false)
  })

  it('reads a row predating the unranked migration as ranked', () => {
    const { unranked: _absent, ...legacy } = getMockTournament()

    const entete = enteteTournoi(legacy)

    expect(entete.nonClasse).toBe(false)
    expect(entete.sousTitre).toBe(
      'Tape un match pour ouvrir le marqueur. Tout se synchronise en direct.',
    )
  })
})
