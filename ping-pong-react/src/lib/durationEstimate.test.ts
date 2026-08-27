import { describe, expect, it } from 'vitest'
import {
  DUREE,
  MODELE_DEFAUT,
  SUGGESTION,
  calibrerDispersion,
  calibrerDuree,
  calibrerEntracte,
  calibrerMatch,
  calibrerPart,
  dureeMatch,
  estimerDuree,
  formatDuree,
  heureDeFin,
  matchsChronometres,
  mediane,
  moindresCarres,
  pointsAttendus,
  probabilite,
  resumeDuree,
  serrage,
  suggererFormat,
  type ModeleDuree,
} from './durationEstimate'
import type { Match, Tournament } from '../types'

const getMockMatch = (overrides?: Partial<Match>): Match => ({
  id: 'm1',
  tournament_id: 't1',
  round: 0,
  idx: 0,
  player_a: 'Léo',
  player_b: 'Thibault',
  player_a_id: 'pa',
  player_b_id: 'pb',
  score_a: 11,
  score_b: 9,
  done: true,
  serve_start: 'a',
  started_at: '2026-08-20T17:00:00.000Z',
  ended_at: '2026-08-20T17:06:00.000Z',
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

const getMockTournament = (overrides?: Partial<Tournament>): Tournament => ({
  id: 't1',
  created_at: '2026-08-20T16:50:00.000Z',
  name: "Tournoi d'août",
  target: 11,
  players: ['Léo', 'Thibault'],
  status: 'done',
  kind: 'tournament',
  format: 'round_robin',
  champion: 'Léo',
  is_active: false,
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

/** A match of `points` points that took `ms`, distinct id so maps don't collide. */
const chrono = (id: string, points: number, ms: number, extra?: Partial<Match>): Match => {
  const debut = Date.parse('2026-08-20T17:00:00.000Z')
  const scoreA = Math.ceil(points / 2)
  return getMockMatch({
    id,
    score_a: scoreA,
    score_b: points - scoreA,
    started_at: new Date(debut).toISOString(),
    ended_at: new Date(debut + ms).toISOString(),
    ...extra,
  })
}

/** A model with round numbers, so expectations can be computed by hand. */
const modele = (overrides?: Partial<ModeleDuree>): ModeleDuree => ({
  fixeMs: 60_000,
  parPointMs: 20_000,
  entracteMs: 120_000,
  partSerree: 0.6,
  partDesequilibree: 0.3,
  dispersion: 0.2,
  echantillon: 100,
  parDefaut: false,
  ...overrides,
})

describe('matchsChronometres', () => {
  it('keeps finished matches that carry both timestamps', () => {
    const chronos = matchsChronometres([chrono('m1', 20, 6 * 60_000)])

    expect(chronos).toEqual([{ ms: 6 * 60_000, points: 20 }])
  })

  it('drops matches that were never timed, never finished, or were walkovers', () => {
    const chronos = matchsChronometres([
      chrono('m1', 20, 6 * 60_000, { started_at: null }),
      chrono('m2', 20, 6 * 60_000, { ended_at: null }),
      chrono('m3', 20, 6 * 60_000, { done: false }),
      chrono('m4', 20, 6 * 60_000, { bye: true }),
    ])

    expect(chronos).toEqual([])
  })

  it('drops a scorer left open over lunch and a mis-tapped instant match', () => {
    const chronos = matchsChronometres([
      chrono('m1', 20, 3 * 60 * 60_000),
      chrono('m2', 20, 5_000),
      chrono('m3', 20, 6 * 60_000),
    ])

    expect(chronos).toEqual([{ ms: 6 * 60_000, points: 20 }])
  })

  it('drops a match whose pace is impossible even though its duration is plausible', () => {
    // 3 points in 40 minutes: the tab was open, the players were not playing.
    const chronos = matchsChronometres([chrono('m1', 3, 40 * 60_000)])

    expect(chronos).toEqual([])
  })
})

describe('mediane', () => {
  it('takes the middle value of an odd list, whatever the input order', () => {
    expect(mediane([9, 1, 5])).toBe(5)
  })

  it('averages the two middle values of an even list', () => {
    expect(mediane([1, 2, 3, 10])).toBe(2.5)
  })

  it('leaves the caller array untouched', () => {
    const values = [3, 1, 2]

    mediane(values)

    expect(values).toEqual([3, 1, 2])
  })
})

describe('moindresCarres', () => {
  it('recovers the line the points sit on', () => {
    const fit = moindresCarres([
      { x: 1, y: 5 },
      { x: 2, y: 7 },
      { x: 3, y: 9 },
    ])

    expect(fit).not.toBeNull()
    expect(fit?.pente).toBeCloseTo(2, 10)
    expect(fit?.ordonnee).toBeCloseTo(3, 10)
  })

  it('refuses a single point and a column of identical x', () => {
    expect(moindresCarres([{ x: 1, y: 5 }])).toBeNull()
    expect(
      moindresCarres([
        { x: 2, y: 5 },
        { x: 2, y: 9 },
      ]),
    ).toBeNull()
  })
})

describe('calibrerMatch', () => {
  it('splits history into a fixed cost and a per-point cost', () => {
    // duration = 60 s + 20 s per point, exactly.
    const chronos = [12, 16, 20, 24].map((points) => ({
      points,
      ms: 60_000 + 20_000 * points,
    }))

    expect(calibrerMatch(chronos)).toEqual({ fixeMs: 60_000, parPointMs: 20_000 })
  })

  it('falls back to the median pace when every match has the same point count', () => {
    const chronos = [
      { points: 20, ms: 6 * 60_000 },
      { points: 20, ms: 8 * 60_000 },
      { points: 20, ms: 7 * 60_000 },
    ]

    expect(calibrerMatch(chronos)).toEqual({ fixeMs: 0, parPointMs: (7 * 60_000) / 20 })
  })

  it('falls back too when a thin sample slopes the wrong way', () => {
    // Longer matches that finished faster — a negative slope would predict
    // negative durations for a long evening.
    const chronos = [
      { points: 16, ms: 10 * 60_000 },
      { points: 30, ms: 4 * 60_000 },
    ]

    const { fixeMs, parPointMs } = calibrerMatch(chronos)

    expect(fixeMs).toBe(0)
    expect(parPointMs).toBeGreaterThan(0)
  })

  it('clamps a fixed cost that history reports as absurdly large', () => {
    const chronos = [
      { points: 20, ms: 50 * 60_000 },
      { points: 24, ms: 51 * 60_000 },
    ]

    expect(calibrerMatch(chronos).fixeMs).toBe(DUREE.maxFixeMs)
  })
})

describe('calibrerDispersion', () => {
  it('reports the typical relative miss of the model', () => {
    // Two matches 20 % under, two 20 % over: the median miss is 20 %.
    const prevu = (points: number) => 60_000 + 20_000 * points
    const chronos = [
      { points: 16, ms: prevu(16) * 0.8 },
      { points: 18, ms: prevu(18) * 0.8 },
      { points: 20, ms: prevu(20) * 1.2 },
      { points: 22, ms: prevu(22) * 1.2 },
    ]

    expect(calibrerDispersion(chronos, 60_000, 20_000)).toBeCloseTo(0.2, 10)
  })

  it('never claims the model is more precise than its floor', () => {
    const chronos = [{ points: 20, ms: 60_000 + 20_000 * 20 }]

    expect(calibrerDispersion(chronos, 60_000, 20_000)).toBe(DUREE.minDispersion)
  })
})

describe('calibrerEntracte', () => {
  const enchaine = (id: string, debut: string, fin: string, extra?: Partial<Match>): Match =>
    getMockMatch({ id, started_at: debut, ended_at: fin, ...extra })

  it('takes the median gap between consecutive matches of a tournament', () => {
    const matches = [
      enchaine('m1', '2026-08-20T17:00:00.000Z', '2026-08-20T17:06:00.000Z'),
      enchaine('m2', '2026-08-20T17:08:00.000Z', '2026-08-20T17:14:00.000Z'), // 2 min
      enchaine('m3', '2026-08-20T17:18:00.000Z', '2026-08-20T17:24:00.000Z'), // 4 min
      enchaine('m4', '2026-08-20T17:27:00.000Z', '2026-08-20T17:33:00.000Z'), // 3 min
    ]

    expect(calibrerEntracte(matches, [getMockTournament()])).toBe(3 * 60_000)
  })

  it('ignores quick games — a single match has no next one', () => {
    const matches = [
      enchaine('m1', '2026-08-20T17:00:00.000Z', '2026-08-20T17:06:00.000Z', {
        tournament_id: 'g1',
      }),
      enchaine('m2', '2026-08-20T17:30:00.000Z', '2026-08-20T17:36:00.000Z', {
        tournament_id: 'g1',
      }),
    ]

    const entracte = calibrerEntracte(matches, [getMockTournament({ id: 'g1', kind: 'game' })])

    expect(entracte).toBeNull()
  })

  it('ignores an abandoned table and matches played in parallel', () => {
    const matches = [
      enchaine('m1', '2026-08-20T17:00:00.000Z', '2026-08-20T17:06:00.000Z'),
      enchaine('m2', '2026-08-20T17:03:00.000Z', '2026-08-20T17:09:00.000Z'), // overlaps
      enchaine('m3', '2026-08-20T19:00:00.000Z', '2026-08-20T19:06:00.000Z'), // two hours later
    ]

    expect(calibrerEntracte(matches, [getMockTournament()])).toBeNull()
  })
})

describe('probabilite / serrage', () => {
  it('gives even players a coin flip and full closeness', () => {
    expect(probabilite(1500, 1500)).toBeCloseTo(0.5, 10)
    expect(serrage(1500, 1500)).toBeCloseTo(1, 10)
  })

  it('reads the same closeness whichever side is the favourite', () => {
    expect(serrage(1800, 1400)).toBeCloseTo(serrage(1400, 1800), 10)
  })

  it('collapses toward zero as the gap widens', () => {
    expect(serrage(1500, 1700)).toBeGreaterThan(serrage(1500, 2100))
    expect(serrage(1500, 2500)).toBeLessThan(0.05)
  })
})

describe('calibrerPart', () => {
  const noteMatch = (
    id: string,
    scoreLoser: number,
    eloA: number,
    eloB: number,
  ): { match: Match; events: { matchId: string; ratingBefore: number }[] } => ({
    match: getMockMatch({ id, score_a: 11, score_b: scoreLoser }),
    events: [
      { matchId: id, ratingBefore: eloA },
      { matchId: id, ratingBefore: eloB },
    ],
  })

  it('reads a longer loser share for even matchups than for walkovers', () => {
    const rows = [
      ...[0, 1, 2, 3].map((i) => noteMatch(`even${i}`, 9, 1500, 1500)),
      ...[0, 1, 2, 3].map((i) => noteMatch(`gap${i}`, 3, 1900, 1300)),
    ]

    const part = calibrerPart(
      rows.map((r) => r.match),
      [getMockTournament()],
      rows.flatMap((r) => r.events),
    )

    expect(part).not.toBeNull()
    expect(part?.partSerree).toBeCloseTo(9 / 11, 2)
    expect(part?.partDesequilibree).toBeLessThan(part?.partSerree ?? 0)
  })

  it('returns null below the sample floor rather than fitting noise', () => {
    const rows = [0, 1, 2].map((i) => noteMatch(`m${i}`, 9, 1500, 1500))

    const part = calibrerPart(
      rows.map((r) => r.match),
      [getMockTournament()],
      rows.flatMap((r) => r.events),
    )

    expect(part).toBeNull()
  })

  it('never lets a wrong-way fit make a walkover the longer match', () => {
    // Deliberately inverted history: the blowouts went to deuce, the even
    // matchups were 11-2. The two ends are ordered so the estimate stays sane.
    const rows = [
      ...[0, 1, 2, 3].map((i) => noteMatch(`even${i}`, 2, 1500, 1500)),
      ...[0, 1, 2, 3].map((i) => noteMatch(`gap${i}`, 9, 1900, 1300)),
    ]

    const part = calibrerPart(
      rows.map((r) => r.match),
      [getMockTournament()],
      rows.flatMap((r) => r.events),
    )

    expect(part?.partSerree).toBeGreaterThanOrEqual(part?.partDesequilibree ?? 0)
  })

  it('skips matches whose tournament target is unknown', () => {
    const rows = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => noteMatch(`m${i}`, 9, 1500, 1500))

    const part = calibrerPart(
      rows.map((r) => r.match),
      [],
      rows.flatMap((r) => r.events),
    )

    expect(part).toBeNull()
  })
})

describe('calibrerDuree', () => {
  it('stays on the defaults until enough matches have been timed', () => {
    const matches = [0, 1, 2].map((i) => chrono(`m${i}`, 20, 6 * 60_000))

    const fit = calibrerDuree(matches, [getMockTournament()], [])

    expect(fit).toEqual({ ...MODELE_DEFAUT, echantillon: 3 })
    expect(fit.parDefaut).toBe(true)
  })

  it('fits the per-match cost once history is deep enough', () => {
    const matches = [12, 14, 16, 18, 20, 22, 24, 26].map((points, i) =>
      chrono(`m${i}`, points, 60_000 + 20_000 * points),
    )

    const fit = calibrerDuree(matches, [getMockTournament()], [])

    expect(fit.fixeMs).toBeCloseTo(60_000, 5)
    expect(fit.parPointMs).toBeCloseTo(20_000, 5)
    expect(fit.echantillon).toBe(8)
    expect(fit.parDefaut).toBe(false)
  })

  it('keeps the default closeness curve when no match carries ratings', () => {
    const matches = [12, 14, 16, 18, 20, 22, 24, 26].map((points, i) =>
      chrono(`m${i}`, points, 60_000 + 20_000 * points),
    )

    const fit = calibrerDuree(matches, [getMockTournament()], [])

    expect(fit.partSerree).toBe(MODELE_DEFAUT.partSerree)
    expect(fit.partDesequilibree).toBe(MODELE_DEFAUT.partDesequilibree)
  })
})

describe('pointsAttendus / dureeMatch', () => {
  it('adds the winner target and the loser share', () => {
    expect(pointsAttendus(modele(), 11, 1)).toBeCloseTo(11 * 1.6, 10)
    expect(pointsAttendus(modele(), 11, 0)).toBeCloseTo(11 * 1.3, 10)
  })

  it('prices a match as the fixed cost plus its points', () => {
    const duree = dureeMatch(modele(), 11, 1500, 1500)

    expect(duree).toBeCloseTo(60_000 + 20_000 * 11 * 1.6, 5)
  })

  it('makes an even matchup longer than a walkover at the same target', () => {
    expect(dureeMatch(modele(), 11, 1500, 1500)).toBeGreaterThan(
      dureeMatch(modele(), 11, 2100, 1300),
    )
  })

  it('scales with the points target', () => {
    expect(dureeMatch(modele(), 21, 1500, 1500)).toBeGreaterThan(
      dureeMatch(modele(), 11, 1500, 1500),
    )
  })
})

describe('estimerDuree', () => {
  const egaux = (n: number) => Array.from({ length: n }, () => 1500)

  it('sums the round-robin schedule and the gaps between its matches', () => {
    const est = estimerDuree({
      variant: 'tournament',
      format: 'round_robin',
      elos: egaux(4),
      target: 11,
      modele: modele(),
    })

    const parMatch = 60_000 + 20_000 * 11 * 1.6
    expect(est?.matchs).toBe(6)
    expect(est?.jeuMs).toBeCloseTo(6 * parMatch, 5)
    expect(est?.entracteTotalMs).toBe(5 * 120_000)
    expect(est?.totalMs).toBeCloseTo(6 * parMatch + 5 * 120_000, 5)
  })

  it('prices a quick game as a single match with no dead time', () => {
    const est = estimerDuree({
      variant: 'game',
      format: 'round_robin',
      elos: [1500, 1500],
      target: 11,
      modele: modele(),
    })

    expect(est?.matchs).toBe(1)
    expect(est?.entracteTotalMs).toBe(0)
    expect(est?.totalMs).toBeCloseTo(60_000 + 20_000 * 11 * 1.6, 5)
  })

  it('counts the 2n−2 games of a bracket, not the round-robin schedule', () => {
    const est = estimerDuree({
      variant: 'tournament',
      format: 'double_elim',
      elos: egaux(8),
      target: 11,
      modele: modele(),
    })

    expect(est?.matchs).toBe(14)
  })

  it('shortens a field with a runaway favourite', () => {
    const commun = {
      variant: 'tournament',
      format: 'round_robin',
      target: 11,
      modele: modele(),
    } as const

    const serre = estimerDuree({ ...commun, elos: [1500, 1500, 1500, 1500] })
    const desequilibre = estimerDuree({ ...commun, elos: [2200, 1500, 1500, 1100] })

    expect(desequilibre?.totalMs).toBeLessThan(serre?.totalMs ?? 0)
    expect(desequilibre?.matchs).toBe(serre?.matchs)
  })

  it('tightens the band as the schedule grows, without ever closing it', () => {
    const commun = {
      variant: 'tournament',
      format: 'round_robin',
      target: 11,
      modele: modele(),
    } as const

    const petit = estimerDuree({ ...commun, elos: egaux(3) })
    const grand = estimerDuree({ ...commun, elos: egaux(10) })

    const largeur = (e: typeof petit) => (e === null ? 0 : (e.hautMs - e.basMs) / e.totalMs)
    expect(largeur(grand)).toBeLessThan(largeur(petit))
    expect(largeur(grand)).toBeGreaterThan(0)
  })

  it('says nothing when the selection cannot be played yet', () => {
    const commun = { format: 'round_robin', target: 11, modele: modele() } as const

    expect(estimerDuree({ ...commun, variant: 'tournament', elos: [1500] })).toBeNull()
    expect(estimerDuree({ ...commun, variant: 'game', elos: [1500] })).toBeNull()
    expect(
      estimerDuree({ ...commun, variant: 'tournament', format: 'double_elim', elos: egaux(2) }),
    ).toBeNull()
    expect(estimerDuree({ ...commun, variant: 'tournament', elos: egaux(4), target: 0 })).toBeNull()
  })
})

describe('formatDuree', () => {
  it('writes minutes below the hour, rounded to five', () => {
    expect(formatDuree(43 * 60_000)).toBe('45 min')
  })

  it('writes hours and minutes in the French idiom', () => {
    expect(formatDuree(84 * 60_000)).toBe('1 h 25')
  })

  it('drops the minutes on a round hour', () => {
    expect(formatDuree(119 * 60_000)).toBe('2 h')
  })

  it('pads the minutes so « 2 h 05 » never reads as « 2 h 5 »', () => {
    expect(formatDuree(124 * 60_000)).toBe('2 h 05')
  })

  it('never prints « 0 min »', () => {
    expect(formatDuree(30_000)).toBe('5 min')
  })
})

describe('heureDeFin', () => {
  it('adds the estimate to the start time entered on the form', () => {
    expect(heureDeFin('17:15', 84 * 60_000)).toBe('18 h 40')
  })

  it('wraps past midnight instead of reporting a 25th hour', () => {
    expect(heureDeFin('23:30', 90 * 60_000)).toBe('1 h 00')
  })

  it('says nothing when no valid start time was given', () => {
    expect(heureDeFin('', 60_000)).toBeNull()
    expect(heureDeFin('demain', 60_000)).toBeNull()
    expect(heureDeFin('26:00', 60_000)).toBeNull()
    expect(heureDeFin('17:75', 60_000)).toBeNull()
  })
})

describe('resumeDuree', () => {
  const estimation = () =>
    estimerDuree({
      variant: 'tournament',
      format: 'round_robin',
      elos: [1500, 1500, 1500, 1500],
      target: 11,
      modele: modele(),
    })

  it('leads with the headline, the band and the per-match detail', () => {
    const est = estimation()
    if (est === null) throw new Error('estimation attendue')

    const resume = resumeDuree(est, '')

    expect(resume.titre).toBe(`≈ ${formatDuree(est.totalMs)}`)
    expect(resume.fourchette).toBe(`entre ${formatDuree(est.basMs)} et ${formatDuree(est.hautMs)}`)
    expect(resume.detail).toBe('6 matchs · ~7 min par match · ~2 min entre deux')
  })

  it('adds the finish time only when a start time was entered', () => {
    const est = estimation()
    if (est === null) throw new Error('estimation attendue')

    expect(resumeDuree(est, '18:00').fin).not.toBeNull()
    expect(resumeDuree(est, '').fin).toBeNull()
  })

  it('drops the between-matches note on a single match', () => {
    const est = estimerDuree({
      variant: 'game',
      format: 'round_robin',
      elos: [1500, 1500],
      target: 11,
      modele: modele(),
    })
    if (est === null) throw new Error('estimation attendue')

    expect(resumeDuree(est, '').detail).toBe('1 match · ~7 min')
  })

  it('says out loud when the numbers are still the built-in defaults', () => {
    const est = estimerDuree({
      variant: 'tournament',
      format: 'round_robin',
      elos: [1500, 1500, 1500],
      target: 11,
      modele: MODELE_DEFAUT,
    })
    if (est === null) throw new Error('estimation attendue')

    expect(resumeDuree(est, '').source).toBe(
      'estimation de départ — pas encore assez de matchs chronométrés',
    )
  })

  it('credits the history it rests on once fitted', () => {
    const est = estimation()
    if (est === null) throw new Error('estimation attendue')

    expect(resumeDuree(est, '').source).toBe('d’après 100 matchs chronométrés')
  })
})

describe('suggererFormat', () => {
  const egaux = (n: number) => Array.from({ length: n }, () => 1500)

  const entree = (n: number, extra?: Partial<Parameters<typeof suggererFormat>[0]>) => ({
    variant: 'tournament' as const,
    format: 'round_robin' as const,
    elos: egaux(n),
    target: 11,
    modele: modele(),
    ...extra,
  })

  it('offers the bracket when the round-robin schedule runs far longer', () => {
    // Six players: 15 round-robin matches against the bracket's 10.
    const suggestion = suggererFormat(entree(6))

    expect(suggestion?.gainMs).toBeCloseTo(7_860_000 - 5_200_000, 5)
    expect(suggestion?.libelle).toBe('−45 min')
  })

  it('says nothing once the bracket is already the chosen format', () => {
    expect(suggererFormat(entree(6, { format: 'double_elim' }))).toBeNull()
  })

  it('says nothing for a quick game, which has no format to choose', () => {
    expect(suggererFormat(entree(2, { variant: 'game', elos: [1500, 1500] }))).toBeNull()
  })

  it('says nothing when both formats play the very same schedule', () => {
    // Four players is the crossover: 6 round-robin matches, 6 bracket matches.
    expect(suggererFormat(entree(4))).toBeNull()
  })

  it('says nothing when the field is too small for a bracket at all', () => {
    expect(suggererFormat(entree(2))).toBeNull()
  })

  it('says nothing when the round-robin is longer but not by enough real time', () => {
    // Five players: 10 matches against 8, yet only some 18 minutes saved.
    expect(suggererFormat(entree(5))).toBeNull()
  })

  it('offers the bracket right on the threshold, not a minute past it', () => {
    // parPointMs 0 pins every match at fixeMs and there is no dead time, so the
    // gap is exactly 2 × fixeMs: 10 round-robin matches against the bracket's 8.
    const suggestion = suggererFormat(
      entree(5, { modele: modele({ fixeMs: 600_000, parPointMs: 0, entracteMs: 0 }) }),
    )

    expect(suggestion?.gainMs).toBe(SUGGESTION.ecartMinMs)
    expect(suggestion?.libelle).toBe('−20 min')
  })

  it('says nothing a hair under the time saved it asks for', () => {
    expect(
      suggererFormat(
        entree(5, { modele: modele({ fixeMs: 590_000, parPointMs: 0, entracteMs: 0 }) }),
      ),
    ).toBeNull()
  })
})
