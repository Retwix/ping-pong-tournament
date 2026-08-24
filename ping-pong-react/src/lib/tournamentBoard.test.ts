import { describe, expect, it } from 'vitest'
import {
  avancement,
  dureeTerminee,
  enteteTournoi,
  etatMatch,
  extremesDuree,
  lignesClassement,
  etatNoeud,
  groupesTableau,
  nomAdversaire,
  noeudsVisibles,
  toursDuTournoi,
} from './tournamentBoard'
import type { TournamentRating } from '../hooks/useRatingDeltas'
import { BYE, TBD } from '../types'
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

const getMockRating = (overrides?: Partial<TournamentRating>): TournamentRating => ({
  key: 'pa',
  name: 'Léo',
  startRating: 1500,
  endRating: 1532,
  netDelta: 32,
  games: 2,
  rank: 1,
  provisional: false,
  ...overrides,
})

/** A finished match, winner first. */
const gagne = (vainqueur: string, perdant: string, sa: number, sb: number, id: string): Match =>
  getMockMatch({ id, done: true, player_a: vainqueur, player_b: perdant, score_a: sa, score_b: sb })

describe('lignesClassement', () => {
  it('ranks players by wins, then by point difference', () => {
    const players = ['Léo', 'Thibault', 'Inès']
    const matches = [
      gagne('Léo', 'Thibault', 11, 2, 'm1'),
      gagne('Inès', 'Thibault', 11, 9, 'm2'),
      gagne('Léo', 'Inès', 11, 5, 'm3'),
    ]

    const { rows } = lignesClassement({ players, matches, ratings: [], unranked: false })

    expect(rows.map((r) => [r.rang, r.name])).toEqual([
      [1, 'Léo'],
      [2, 'Inès'],
      [3, 'Thibault'],
    ])
  })

  it('numbers the ranks from one', () => {
    const { rows } = lignesClassement({
      players: ['Léo', 'Thibault'],
      matches: [gagne('Léo', 'Thibault', 11, 3, 'm1')],
      ratings: [],
      unranked: false,
    })

    expect(rows.map((r) => r.rang)).toEqual([1, 2])
  })

  it('carries each player record through to the row', () => {
    const { rows } = lignesClassement({
      players: ['Léo', 'Thibault'],
      matches: [gagne('Léo', 'Thibault', 11, 3, 'm1')],
      ratings: [],
      unranked: false,
    })

    expect(rows[0]).toMatchObject({
      name: 'Léo',
      played: 1,
      wins: 1,
      pointsFor: 11,
      pointsAgainst: 3,
      diff: 8,
    })
    expect(rows[1]).toMatchObject({ name: 'Thibault', wins: 0, diff: -8 })
  })

  it('shows the Elo column on a ranked tournament that has ratings', () => {
    const result = lignesClassement({
      players: ['Léo', 'Thibault'],
      matches: [gagne('Léo', 'Thibault', 11, 3, 'm1')],
      ratings: [getMockRating()],
      unranked: false,
    })

    expect(result.afficherElo).toBe(true)
    expect(result.note).toBeNull()
  })

  it('hides the Elo column entirely on an unranked tournament', () => {
    const result = lignesClassement({
      players: ['Léo', 'Thibault'],
      matches: [gagne('Léo', 'Thibault', 11, 3, 'm1')],
      ratings: [getMockRating()],
      unranked: true,
    })

    expect(result.afficherElo).toBe(false)
    expect(result.note).toBe('Tournoi non classé — les résultats ne changent aucun Elo.')
  })

  it('hides the Elo column before any rating has been recorded', () => {
    const result = lignesClassement({
      players: ['Léo', 'Thibault'],
      matches: [],
      ratings: [],
      unranked: false,
    })

    expect(result.afficherElo).toBe(false)
    expect(result.note).toBeNull()
  })

  it('attaches a player their entry and exit rating', () => {
    const { rows } = lignesClassement({
      players: ['Léo', 'Thibault'],
      matches: [gagne('Léo', 'Thibault', 11, 3, 'm1')],
      ratings: [getMockRating({ name: 'Léo', startRating: 1500, endRating: 1532, netDelta: 32 })],
      unranked: false,
    })

    expect(rows[0].elo).toEqual({ net: 32, depart: 1500, arrivee: 1532 })
  })

  it('leaves a player without a rating entry with no Elo at all', () => {
    const { rows } = lignesClassement({
      players: ['Léo', 'Thibault'],
      matches: [gagne('Léo', 'Thibault', 11, 3, 'm1')],
      ratings: [getMockRating({ name: 'Léo' })],
      unranked: false,
    })

    expect(rows[1].name).toBe('Thibault')
    expect(rows[1].elo).toBeNull()
  })

  it('rounds fractional Glicko movement to whole points', () => {
    const { rows } = lignesClassement({
      players: ['Léo', 'Thibault'],
      matches: [gagne('Léo', 'Thibault', 11, 3, 'm1')],
      ratings: [
        getMockRating({ name: 'Léo', startRating: 1499.6, endRating: 1531.4, netDelta: 31.8 }),
      ],
      unranked: false,
    })

    expect(rows[0].elo).toEqual({ net: 32, depart: 1500, arrivee: 1531 })
  })

  it('keeps a player who has not played yet, and ranks their nil record above a heavy defeat', () => {
    const { rows } = lignesClassement({
      players: ['Léo', 'Thibault', 'Candice'],
      matches: [gagne('Léo', 'Thibault', 11, 3, 'm1')],
      ratings: [],
      unranked: false,
    })

    expect(rows).toHaveLength(3)
    expect(rows.map((r) => [r.rang, r.name])).toEqual([
      [1, 'Léo'],
      [2, 'Candice'],
      [3, 'Thibault'],
    ])
    expect(rows[1]).toMatchObject({ name: 'Candice', played: 0, wins: 0, diff: 0 })
  })
})

/** A bracket node. `idx` orders nodes inside a round. */
const noeud = (
  bracket: 'W' | 'L' | 'GF',
  round: number,
  idx: number,
  overrides?: Partial<Match>,
): Match =>
  getMockMatch({
    id: `${bracket}${round}-${idx}`,
    match_key: `${bracket}${round}-${idx}`,
    bracket,
    round,
    idx,
    ...overrides,
  })

describe('nomAdversaire', () => {
  it('names an opponent who is already known', () => {
    expect(nomAdversaire('Léo')).toBe('Léo')
  })

  it('reads an unresolved slot as à déterminer', () => {
    expect(nomAdversaire(TBD)).toBe('À déterminer')
  })

  it('names a walkover slot as a bye', () => {
    expect(nomAdversaire(BYE)).toBe('Bye')
  })
})

describe('etatNoeud', () => {
  it('reads a finished node as terminé', () => {
    expect(etatNoeud(noeud('W', 1, 0, { done: true, score_a: 11, score_b: 6 }))).toBe('Terminé')
  })

  it('reads a node with points on the board as en cours', () => {
    expect(etatNoeud(noeud('W', 1, 0, { score_a: 4 }))).toBe('En cours')
  })

  it('reads a node with both opponents known as prêt', () => {
    expect(etatNoeud(noeud('W', 1, 0, { player_a: 'Léo', player_b: 'Inès' }))).toBe('Prêt')
  })

  it('reads a node still waiting on a feeder as en attente, not prêt', () => {
    expect(etatNoeud(noeud('W', 2, 0, { player_a: 'Léo', player_b: TBD }))).toBe('En attente')
  })

  it('waits when neither opponent is known yet', () => {
    expect(etatNoeud(noeud('L', 1, 0, { player_a: TBD, player_b: TBD }))).toBe('En attente')
  })

  it('does not call a walkover slot playable', () => {
    expect(etatNoeud(noeud('W', 1, 0, { player_a: 'Léo', player_b: BYE }))).toBe('En attente')
  })
})

describe('noeudsVisibles', () => {
  it('hides auto-completed walkovers, which nobody plays', () => {
    const reel = noeud('W', 1, 0, { player_a: 'Léo', player_b: 'Inès' })
    const walkover = noeud('W', 1, 1, { player_b: BYE, bye: true, done: true })

    expect(noeudsVisibles([reel, walkover]).map((m) => m.id)).toEqual([reel.id])
  })

  it('keeps every real node', () => {
    const nodes = [noeud('W', 1, 0), noeud('L', 1, 0), noeud('GF', 1, 0)]

    expect(noeudsVisibles(nodes)).toHaveLength(3)
  })
})

describe('groupesTableau', () => {
  it('splits the bracket into main, losers and grand final', () => {
    const nodes = [
      noeud('W', 1, 0, { player_a: 'Léo', player_b: 'Inès' }),
      noeud('L', 1, 0, { player_a: 'Marc', player_b: 'Zoé' }),
      noeud('GF', 1, 0),
    ]

    expect(groupesTableau(nodes).map((g) => g.titre)).toEqual([
      'Tableau principal',
      'Tableau des perdants',
      'Grande finale',
    ])
  })

  it('omits the losers group entirely when there is none', () => {
    const nodes = [noeud('W', 1, 0), noeud('GF', 1, 0)]

    expect(groupesTableau(nodes).map((g) => g.groupe)).toEqual(['principal', 'finale'])
  })

  it('omits the grand final until that node exists', () => {
    expect(groupesTableau([noeud('W', 1, 0)]).map((g) => g.groupe)).toEqual(['principal'])
  })

  it('has nothing to show for an empty bracket', () => {
    expect(groupesTableau([])).toEqual([])
  })

  it('orders each group into columns by round', () => {
    const nodes = [
      noeud('W', 2, 0, { player_a: 'Léo', player_b: TBD }),
      noeud('W', 1, 0, { player_a: 'Léo', player_b: 'Inès' }),
      noeud('W', 1, 1, { player_a: 'Marc', player_b: 'Zoé' }),
    ]

    const [principal] = groupesTableau(nodes)

    expect(principal.colonnes).toHaveLength(2)
    expect(principal.colonnes[0].noeuds.map((m) => m.id)).toEqual(['W1-0', 'W1-1'])
    expect(principal.colonnes[1].noeuds.map((m) => m.id)).toEqual(['W2-0'])
  })

  it('sorts nodes inside a column by their bracket position', () => {
    const nodes = [noeud('W', 1, 2), noeud('W', 1, 0), noeud('W', 1, 1)]

    expect(groupesTableau(nodes)[0].colonnes[0].noeuds.map((m) => m.idx)).toEqual([0, 1, 2])
  })

  it('titles the last winners round the final, and the one before it the semi', () => {
    const nodes = [noeud('W', 1, 0), noeud('W', 2, 0), noeud('W', 3, 0)]

    expect(groupesTableau(nodes)[0].colonnes.map((c) => c.titre)).toEqual([
      'Gagnants · tour 1',
      'Demi-finale gagnants',
      'Finale gagnants',
    ])
  })

  it('titles the last losers round the losers final', () => {
    const nodes = [noeud('L', 1, 0), noeud('L', 2, 0)]

    expect(groupesTableau(nodes)[0].colonnes.map((c) => c.titre)).toEqual([
      'Perdants · tour 1',
      'Finale perdants',
    ])
  })

  it('leaves walkovers out of the columns', () => {
    const nodes = [
      noeud('W', 1, 0, { player_a: 'Léo', player_b: 'Inès' }),
      noeud('W', 1, 1, { player_b: BYE, bye: true, done: true }),
    ]

    expect(groupesTableau(nodes)[0].colonnes[0].noeuds).toHaveLength(1)
  })
})

describe('bracket depth', () => {
  it('reads a node as en cours when only the second player has scored', () => {
    expect(etatNoeud(noeud('W', 1, 0, { score_a: 0, score_b: 3 }))).toBe('En cours')
  })

  it('measures each bracket depth separately, so a deep losers side does not retitle the winners final', () => {
    const nodes = [
      noeud('W', 1, 0),
      noeud('W', 2, 0),
      noeud('L', 1, 0),
      noeud('L', 2, 0),
      noeud('L', 3, 0),
    ]

    const [principal, perdants] = groupesTableau(nodes)

    expect(principal.colonnes.map((c) => c.titre)).toEqual([
      'Demi-finale gagnants',
      'Finale gagnants',
    ])
    expect(perdants.colonnes.map((c) => c.titre)).toEqual([
      'Perdants · tour 1',
      'Perdants · tour 2',
      'Finale perdants',
    ])
  })
})
