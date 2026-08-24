import { describe, expect, it } from 'vitest'
import {
  avancement,
  dureeTerminee,
  enteteTournoi,
  etatMatch,
  extremesDuree,
  toursDuTournoi,
} from './tournamentBoard'
import type { Match, Tournament } from '../types'

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

const getMockMatch = (overrides?: Partial<Match>): Match => ({
  id: 'm1',
  tournament_id: 't1',
  round: 1,
  idx: 0,
  player_a: 'Léo',
  player_b: 'Thibault',
  player_a_id: 'pa',
  player_b_id: 'pb',
  score_a: 0,
  score_b: 0,
  done: false,
  serve_start: 'a',
  started_at: null,
  ended_at: null,
  bracket: null,
  match_key: null,
  win_to: null,
  win_slot: null,
  lose_to: null,
  lose_slot: null,
  bye: false,
  mb_saved_a: 0,
  mb_saved_b: 0,
  ...overrides,
})

/** A match played from `from` for `seconds`, so durations are deterministic. */
const joue = (seconds: number, overrides?: Partial<Match>): Match =>
  getMockMatch({
    done: true,
    score_a: 11,
    score_b: 7,
    started_at: '2026-08-24T10:00:00.000Z',
    ended_at: new Date(Date.UTC(2026, 7, 24, 10, 0, seconds)).toISOString(),
    ...overrides,
  })

describe('etatMatch', () => {
  it('reads a finished match as terminé', () => {
    expect(etatMatch(getMockMatch({ done: true, score_a: 11, score_b: 4 }))).toBe('Terminé')
  })

  it('reads an unfinished match that has scored as en cours', () => {
    expect(etatMatch(getMockMatch({ score_a: 3, score_b: 2 }))).toBe('En cours')
  })

  it('treats a single point for either side as under way', () => {
    expect(etatMatch(getMockMatch({ score_a: 1, score_b: 0 }))).toBe('En cours')
    expect(etatMatch(getMockMatch({ score_a: 0, score_b: 1 }))).toBe('En cours')
  })

  it('reads a goalless unfinished match as still to play', () => {
    expect(etatMatch(getMockMatch())).toBe('À jouer')
  })

  it('keeps a finished match terminé even at nil-nil', () => {
    expect(etatMatch(getMockMatch({ done: true }))).toBe('Terminé')
  })
})

describe('toursDuTournoi', () => {
  it('groups matches by round, in ascending round order', () => {
    const tournoi = getMockTournament({ players: ['Léo', 'Thibault', 'Inès', 'Candice'] })
    const matches = [
      getMockMatch({ id: 'r2', round: 2, player_a: 'Léo', player_b: 'Inès' }),
      getMockMatch({ id: 'r1', round: 1, player_a: 'Léo', player_b: 'Thibault' }),
    ]

    const tours = toursDuTournoi(tournoi, matches)

    expect(tours.map((t) => t.round)).toEqual([1, 2])
    expect(tours[0].matches.map((m) => m.id)).toEqual(['r1'])
    expect(tours[1].matches.map((m) => m.id)).toEqual(['r2'])
  })

  it('names the player sitting out when the count is odd', () => {
    const tournoi = getMockTournament({ players: ['Léo', 'Thibault', 'Candice'] })
    const matches = [getMockMatch({ round: 1, player_a: 'Léo', player_b: 'Thibault' })]

    expect(toursDuTournoi(tournoi, matches)[0].exempts).toEqual(['Candice'])
  })

  it('leaves nobody exempt when everyone plays that round', () => {
    const tournoi = getMockTournament({ players: ['Léo', 'Thibault', 'Inès', 'Candice'] })
    const matches = [
      getMockMatch({ id: 'a', round: 1, player_a: 'Léo', player_b: 'Thibault' }),
      getMockMatch({ id: 'b', round: 1, player_a: 'Inès', player_b: 'Candice' }),
    ]

    expect(toursDuTournoi(tournoi, matches)[0].exempts).toEqual([])
  })

  it('keeps the exempt list in registration order when several sit out', () => {
    const tournoi = getMockTournament({ players: ['Léo', 'Thibault', 'Inès', 'Candice', 'Marc'] })
    const matches = [getMockMatch({ round: 1, player_a: 'Léo', player_b: 'Thibault' })]

    expect(toursDuTournoi(tournoi, matches)[0].exempts).toEqual(['Inès', 'Candice', 'Marc'])
  })

  it('returns no rounds at all for a tournament with no matches', () => {
    expect(toursDuTournoi(getMockTournament(), [])).toEqual([])
  })
})

describe('avancement', () => {
  it('counts finished matches against the total', () => {
    const matches = [
      getMockMatch({ id: 'a', done: true }),
      getMockMatch({ id: 'b', done: true }),
      getMockMatch({ id: 'c' }),
    ]

    expect(avancement(matches)).toEqual({ joues: 2, total: 3, ratio: 2 / 3 })
  })

  it('reports nothing played before the first result', () => {
    expect(avancement([getMockMatch({ id: 'a' }), getMockMatch({ id: 'b' })])).toEqual({
      joues: 0,
      total: 2,
      ratio: 0,
    })
  })

  it('reports a full bar once every match is played', () => {
    expect(avancement([getMockMatch({ id: 'a', done: true })])).toEqual({
      joues: 1,
      total: 1,
      ratio: 1,
    })
  })

  it('does not divide by zero on an empty schedule', () => {
    expect(avancement([])).toEqual({ joues: 0, total: 0, ratio: 0 })
  })
})

describe('extremesDuree', () => {
  it('picks out the longest and the shortest played match', () => {
    const court = joue(90, { id: 'court', player_a: 'Inès', player_b: 'Candice' })
    const moyen = joue(300, { id: 'moyen' })
    const long = joue(600, { id: 'long', player_a: 'Marc', player_b: 'Zoé' })

    const extremes = extremesDuree([moyen, long, court])

    expect(extremes).toEqual({
      plusLong: { match: long, ms: 600_000 },
      plusCourt: { match: court, ms: 90_000 },
    })
  })

  it('reports the same match as both when only one has been timed', () => {
    const seul = joue(120, { id: 'seul' })

    expect(extremesDuree([seul, getMockMatch({ id: 'pas-joue' })])).toEqual({
      plusLong: { match: seul, ms: 120_000 },
      plusCourt: { match: seul, ms: 120_000 },
    })
  })

  it('ignores a finished match that was never timed', () => {
    const sansChrono = getMockMatch({ id: 'sans', done: true, started_at: null, ended_at: null })
    const chronometre = joue(240, { id: 'avec' })

    expect(extremesDuree([sansChrono, chronometre])).toEqual({
      plusLong: { match: chronometre, ms: 240_000 },
      plusCourt: { match: chronometre, ms: 240_000 },
    })
  })

  it('ignores a match still under way, which has no end time yet', () => {
    const enCours = getMockMatch({
      id: 'live',
      score_a: 5,
      started_at: '2026-08-24T10:00:00.000Z',
      ended_at: null,
    })

    expect(extremesDuree([enCours])).toBeNull()
  })

  it('ignores a match validated without a start time', () => {
    const sansDepart = getMockMatch({
      id: 'sans-depart',
      done: true,
      started_at: null,
      ended_at: '2026-08-24T10:05:00.000Z',
    })
    const chronometre = joue(240, { id: 'avec' })

    expect(extremesDuree([sansDepart, chronometre])).toEqual({
      plusLong: { match: chronometre, ms: 240_000 },
      plusCourt: { match: chronometre, ms: 240_000 },
    })
  })

  it('ignores a timed match that was never validated', () => {
    const abandonne = getMockMatch({
      id: 'abandonne',
      done: false,
      score_a: 4,
      started_at: '2026-08-24T09:00:00.000Z',
      ended_at: '2026-08-24T11:00:00.000Z',
    })
    const chronometre = joue(240, { id: 'avec' })

    expect(extremesDuree([abandonne, chronometre])).toEqual({
      plusLong: { match: chronometre, ms: 240_000 },
      plusCourt: { match: chronometre, ms: 240_000 },
    })
  })

  it('ignores a validated match left without an end time, whose duration would keep growing', () => {
    const sansFin = getMockMatch({
      id: 'sans-fin',
      done: true,
      started_at: '2026-08-24T09:00:00.000Z',
      ended_at: null,
    })
    const chronometre = joue(240, { id: 'avec' })

    expect(extremesDuree([sansFin, chronometre])).toEqual({
      plusLong: { match: chronometre, ms: 240_000 },
      plusCourt: { match: chronometre, ms: 240_000 },
    })
  })

  it('has nothing to report before any match has been timed', () => {
    expect(extremesDuree([getMockMatch()])).toBeNull()
  })

  it('keeps the first of two matches of identical duration', () => {
    const premier = joue(180, { id: 'premier' })
    const second = joue(180, { id: 'second' })

    expect(extremesDuree([premier, second])).toEqual({
      plusLong: { match: premier, ms: 180_000 },
      plusCourt: { match: premier, ms: 180_000 },
    })
  })
})

describe('dureeTerminee', () => {
  it('measures a match that ran from start to finish', () => {
    expect(dureeTerminee(joue(315))).toBe(315_000)
  })

  it('has no duration for a match still under way', () => {
    expect(
      dureeTerminee(getMockMatch({ score_a: 5, started_at: '2026-08-24T10:00:00.000Z' })),
    ).toBeNull()
  })

  it('has no duration for a match validated without a start time', () => {
    expect(
      dureeTerminee(
        getMockMatch({ done: true, started_at: null, ended_at: '2026-08-24T10:05:00.000Z' }),
      ),
    ).toBeNull()
  })

  it('has no duration for a match validated without an end time', () => {
    expect(
      dureeTerminee(
        getMockMatch({ done: true, started_at: '2026-08-24T09:00:00.000Z', ended_at: null }),
      ),
    ).toBeNull()
  })

  it('has no duration for a timed match that was never validated', () => {
    expect(
      dureeTerminee(
        getMockMatch({
          done: false,
          started_at: '2026-08-24T09:00:00.000Z',
          ended_at: '2026-08-24T11:00:00.000Z',
        }),
      ),
    ).toBeNull()
  })

  it('has no duration for an untouched match', () => {
    expect(dureeTerminee(getMockMatch())).toBeNull()
  })
})
