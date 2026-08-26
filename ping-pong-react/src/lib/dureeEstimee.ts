// « Ça va durer combien de temps ? » — answered from the club's own history.
//
// Every finished match carries `started_at` / `ended_at`, so the app already
// knows how long a game to 11 takes *here*; nothing has to be guessed. The
// estimate is three fitted pieces:
//
//   1. Per match — duration ≈ fixe + parPoint × (points played), fitted by
//      least squares over timed matches. The intercept absorbs what does not
//      scale with the rally count (walking to the table, the knock-up, saving
//      the score); the slope is the real cost of one point in this room.
//   2. Points played — the winner takes `target`, so it is the loser's share
//      that varies, and it varies with how evenly matched the two sides are.
//      Fitted against the pre-match Elo gap: that is how the level of the
//      players moves the estimate. A field of equals grinds out deuces; a field
//      where the top seed meets a beginner is over in four minutes.
//   3. Between matches — the median gap between one match ending and the next
//      starting in the same tournament: the real dead time of a single table.
//
// Everything is pure and injectable so the fit is unit-testable, and every
// fitted number is clamped. A handful of odd rows (a scorer left open over
// lunch, a match validated twice) must never produce an absurd estimate.

import { doubleElimMatchCount, MIN_DE_PLAYERS } from './doubleElim'
import { matchDuration } from './pingpong'
import type { RatingEvent } from './rating'
import { matchCount } from './roundRobin'
import type { Match, Tournament, TournamentFormat } from '../types'

// ---------- tunables (one place) ----------

/** Guard rails on what counts as a plausible timed match, and on the fit itself. */
export const DUREE = {
  /** A match under 20 s is a scorer misfire, over an hour a forgotten tab. */
  minMatchMs: 20_000,
  maxMatchMs: 60 * 60_000,
  /** Same idea per point: keeps a 3-point match of 40 min out of the slope. */
  minMsParPoint: 2_000,
  maxMsParPoint: 120_000,
  /** Longer than this between two matches and the table was simply abandoned. */
  maxEntracteMs: 20 * 60_000,
  /** Below this many timed matches the fit is noise — the defaults are honest. */
  minEchantillon: 8,
  /** Clamps on the fitted per-match constants. */
  maxFixeMs: 5 * 60_000,
  /** Clamps on the fitted loser share (of `target`). */
  minPart: 0.1,
  maxPart: 1.1,
  /** Clamps on the relative spread used for the ± band. */
  minDispersion: 0.08,
  maxDispersion: 0.6,
} as const

/**
 * What the model says before the club has played enough timed matches: a game
 * to 11 between equals lands around six minutes, with a minute and a half
 * between matches. Replaced piece by piece as history accumulates.
 */
export const MODELE_DEFAUT: ModeleDuree = {
  fixeMs: 45_000,
  parPointMs: 17_500,
  entracteMs: 90_000,
  partSerree: 0.62,
  partDesequilibree: 0.32,
  dispersion: 0.28,
  echantillon: 0,
  parDefaut: true,
}

/** The fitted cost model: one match, and the dead time around it. */
export interface ModeleDuree {
  /** Per-match cost that does not scale with the rally count, in ms. */
  fixeMs: number
  /** Marginal cost of one point played, in ms. */
  parPointMs: number
  /** Median dead time between two matches of the same tournament, in ms. */
  entracteMs: number
  /** Loser's share of `target` when the two sides are evenly matched. */
  partSerree: number
  /** Loser's share of `target` when one side is a heavy favourite. */
  partDesequilibree: number
  /** Relative spread of the per-match residuals — drives the ± band. */
  dispersion: number
  /** Timed matches the fit rests on. */
  echantillon: number
  /** True while some or all of the model is still the built-in default. */
  parDefaut: boolean
}

// ---------- calibration ----------

/** One timed match reduced to what the fit needs. */
export interface MatchChronometre {
  ms: number
  points: number
}

/**
 * The timed matches worth fitting on: finished, both timestamps recorded, and
 * neither the duration nor the per-point pace absurd. Byes never happened, so
 * they carry no time.
 */
export function matchsChronometres(matches: Match[]): MatchChronometre[] {
  const out: MatchChronometre[] = []
  for (const m of matches) {
    if (!m.done || m.bye || m.started_at === null || m.ended_at === null) continue
    const points = m.score_a + m.score_b
    if (points <= 0) continue
    const ms = matchDuration(m)
    if (ms < DUREE.minMatchMs || ms > DUREE.maxMatchMs) continue
    const parPoint = ms / points
    if (parPoint < DUREE.minMsParPoint || parPoint > DUREE.maxMsParPoint) continue
    out.push({ ms, points })
  }
  return out
}

/** Median of a non-empty list. Sorts a copy — the caller's array is untouched. */
export function mediane(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/** Ordinary least squares. Returns null when x has no spread to fit on. */
export function moindresCarres(
  points: { x: number; y: number }[],
): { pente: number; ordonnee: number } | null {
  const n = points.length
  if (n < 2) return null
  const mx = points.reduce((s, p) => s + p.x, 0) / n
  const my = points.reduce((s, p) => s + p.y, 0) / n
  let num = 0
  let den = 0
  for (const p of points) {
    num += (p.x - mx) * (p.y - my)
    den += (p.x - mx) * (p.x - mx)
  }
  if (den === 0) return null
  const pente = num / den
  return { pente, ordonnee: my - pente * mx }
}

const borne = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v))

/**
 * Per-match cost from timed history. Least squares on (points, duration), with
 * a median-rate fallback whenever the fit is degenerate — every match to the
 * same total, or a slope that comes out negative because two long blowouts
 * dominate a thin sample. Both branches are clamped.
 */
export function calibrerMatch(chronos: MatchChronometre[]): { fixeMs: number; parPointMs: number } {
  const fit = moindresCarres(chronos.map((c) => ({ x: c.points, y: c.ms })))
  if (fit === null || fit.pente < DUREE.minMsParPoint || fit.ordonnee < 0) {
    return {
      fixeMs: 0,
      parPointMs: borne(
        mediane(chronos.map((c) => c.ms / c.points)),
        DUREE.minMsParPoint,
        DUREE.maxMsParPoint,
      ),
    }
  }
  return {
    fixeMs: borne(fit.ordonnee, 0, DUREE.maxFixeMs),
    parPointMs: borne(fit.pente, DUREE.minMsParPoint, DUREE.maxMsParPoint),
  }
}

/** Typical relative miss of the per-match model — the half-width of the ± band. */
export function calibrerDispersion(
  chronos: MatchChronometre[],
  fixeMs: number,
  parPointMs: number,
): number {
  const ecarts = chronos.map((c) => {
    const prevu = fixeMs + parPointMs * c.points
    return Math.abs(c.ms - prevu) / prevu
  })
  return borne(mediane(ecarts), DUREE.minDispersion, DUREE.maxDispersion)
}

/**
 * Median dead time between two consecutive matches of the same tournament.
 * Quick games are skipped (a single match has no "next"), as are overlapping
 * matches: two tables running at once say nothing about a one-table evening.
 */
export function calibrerEntracte(
  matches: Match[],
  tournaments: Pick<Tournament, 'id' | 'kind'>[],
): number | null {
  const tournois = new Set(tournaments.filter((t) => t.kind === 'tournament').map((t) => t.id))
  const parTournoi = new Map<string, { debut: number; fin: number }[]>()
  for (const m of matches) {
    if (!tournois.has(m.tournament_id) || m.bye) continue
    if (m.started_at === null || m.ended_at === null) continue
    const list = parTournoi.get(m.tournament_id) ?? []
    list.push({ debut: Date.parse(m.started_at), fin: Date.parse(m.ended_at) })
    parTournoi.set(m.tournament_id, list)
  }

  const gaps: number[] = []
  for (const list of parTournoi.values()) {
    const ordre = [...list].sort((a, b) => a.debut - b.debut)
    for (let i = 1; i < ordre.length; i++) {
      const gap = ordre[i].debut - ordre[i - 1].fin
      if (gap > 0 && gap <= DUREE.maxEntracteMs) gaps.push(gap)
    }
  }
  return gaps.length === 0 ? null : mediane(gaps)
}

/** Win probability of the higher-rated side, on the usual 400-point Elo curve. */
export function probabilite(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400))
}

/**
 * How evenly matched two players are: 1 for a coin flip, 0 for a certainty.
 * This is the single knob the players' level turns in the whole estimate.
 */
export function serrage(eloA: number, eloB: number): number {
  return 1 - Math.abs(2 * probabilite(eloA, eloB) - 1)
}

/**
 * The loser's share of `target`, fitted against how even the matchup was. Needs
 * the pre-match ratings, which is exactly what the rating replay records, so
 * the fit sees each match as it was played rather than through today's ladder.
 */
export function calibrerPart(
  matches: Match[],
  tournaments: Pick<Tournament, 'id' | 'target'>[],
  events: Pick<RatingEvent, 'matchId' | 'ratingBefore'>[],
): { partSerree: number; partDesequilibree: number } | null {
  const targetParTournoi = new Map(tournaments.map((t) => [t.id, t.target]))
  const cotes = new Map<string, number[]>()
  for (const e of events) {
    const list = cotes.get(e.matchId) ?? []
    list.push(e.ratingBefore)
    cotes.set(e.matchId, list)
  }

  const points: { x: number; y: number }[] = []
  for (const m of matches) {
    if (!m.done || m.bye) continue
    const target = targetParTournoi.get(m.tournament_id)
    if (target === undefined || target < 1) continue
    const elos = cotes.get(m.id)
    if (elos === undefined || elos.length !== 2) continue
    const part = Math.min(m.score_a, m.score_b) / target
    if (part > DUREE.maxPart) continue
    points.push({ x: serrage(elos[0], elos[1]), y: part })
  }
  if (points.length < DUREE.minEchantillon) return null

  const fit = moindresCarres(points)
  if (fit === null) return null
  // The fit is read at the two ends of the closeness scale, then ordered: a
  // thin sample can slope the wrong way, and a lopsided match is never the
  // longer one.
  const serree = borne(fit.ordonnee + fit.pente, DUREE.minPart, DUREE.maxPart)
  const desequilibree = borne(fit.ordonnee, DUREE.minPart, DUREE.maxPart)
  return {
    partSerree: Math.max(serree, desequilibree),
    partDesequilibree: Math.min(serree, desequilibree),
  }
}

/**
 * The whole model, fitted from history. Falls back to `MODELE_DEFAUT` piece by
 * piece: a club with timed matches but no rated ones still gets a real per-match
 * cost, with the default closeness curve on top.
 */
export function calibrerDuree(
  matches: Match[],
  tournaments: Pick<Tournament, 'id' | 'kind' | 'target'>[],
  events: Pick<RatingEvent, 'matchId' | 'ratingBefore'>[],
): ModeleDuree {
  const chronos = matchsChronometres(matches)
  if (chronos.length < DUREE.minEchantillon) {
    return { ...MODELE_DEFAUT, echantillon: chronos.length }
  }

  const { fixeMs, parPointMs } = calibrerMatch(chronos)
  const part = calibrerPart(matches, tournaments, events)
  const entracteMs = calibrerEntracte(matches, tournaments)
  return {
    fixeMs,
    parPointMs,
    entracteMs: entracteMs ?? MODELE_DEFAUT.entracteMs,
    partSerree: part?.partSerree ?? MODELE_DEFAUT.partSerree,
    partDesequilibree: part?.partDesequilibree ?? MODELE_DEFAUT.partDesequilibree,
    dispersion: calibrerDispersion(chronos, fixeMs, parPointMs),
    echantillon: chronos.length,
    parDefaut: false,
  }
}

// ---------- estimation ----------

export interface EntreeEstimation {
  /** A quick game is a single match; a tournament expands to its schedule. */
  variant: 'game' | 'tournament'
  format: TournamentFormat
  /** Elo of each selected player, in pick order. Unrated players sit at R0. */
  elos: number[]
  target: number
  modele: ModeleDuree
}

export interface EstimationDuree {
  /** Central estimate, playing time plus the gaps between matches. */
  totalMs: number
  /** Low and high ends of the band. */
  basMs: number
  hautMs: number
  /** Matches actually played (byes take no time). */
  matchs: number
  /** Playing time only, and the dead time around it. */
  jeuMs: number
  entracteTotalMs: number
  /** Average match length, for the « ~7 min par match » line. */
  parMatchMs: number
  modele: ModeleDuree
}

/** Expected number of points played in one match — winner's `target` plus the loser's share. */
export function pointsAttendus(modele: ModeleDuree, target: number, c: number): number {
  const part = modele.partDesequilibree + (modele.partSerree - modele.partDesequilibree) * c
  return target * (1 + part)
}

/** Expected length of one match between two players of these levels. */
export function dureeMatch(
  modele: ModeleDuree,
  target: number,
  eloA: number,
  eloB: number,
): number {
  return modele.fixeMs + modele.parPointMs * pointsAttendus(modele, target, serrage(eloA, eloB))
}

/** Every unordered pair of the field — the round-robin schedule, order aside. */
function paires(elos: number[]): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < elos.length; i++) {
    for (let j = i + 1; j < elos.length; j++) out.push([elos[i], elos[j]])
  }
  return out
}

/**
 * How long this tournament should take. Null when the selection cannot be
 * played yet (too few players), so the caller simply shows nothing.
 *
 * Round-robin sums the real schedule, pair by pair, so a field with one clear
 * favourite comes out shorter than a field of equals. A bracket's matchups are
 * not known before it is drawn, so double elimination uses the average matchup
 * of the field over the 2n−2 games it will play.
 */
export function estimerDuree(entree: EntreeEstimation): EstimationDuree | null {
  const { variant, format, elos, target, modele } = entree
  if (target < 1) return null

  const toutes = paires(elos)
  const n = elos.length

  let matchs: number
  let jeuMs: number
  if (variant === 'game') {
    if (n !== 2) return null
    matchs = 1
    jeuMs = dureeMatch(modele, target, elos[0], elos[1])
  } else if (format === 'double_elim') {
    if (n < MIN_DE_PLAYERS) return null
    matchs = doubleElimMatchCount(n)
    const moyenne =
      toutes.reduce((s, [a, b]) => s + dureeMatch(modele, target, a, b), 0) / toutes.length
    jeuMs = moyenne * matchs
  } else {
    if (n < 2) return null
    matchs = matchCount(n)
    jeuMs = toutes.reduce((s, [a, b]) => s + dureeMatch(modele, target, a, b), 0)
  }

  const entracteTotalMs = Math.max(0, matchs - 1) * modele.entracteMs
  const totalMs = jeuMs + entracteTotalMs
  // Per-match misses partly cancel over a long evening, so the band tightens as
  // the schedule grows — but never past a floor: the model itself is a guess.
  const bande = Math.max(0.06, modele.dispersion / Math.sqrt(matchs))
  return {
    totalMs,
    basMs: totalMs * (1 - bande),
    hautMs: totalMs * (1 + bande),
    matchs,
    jeuMs,
    entracteTotalMs,
    parMatchMs: jeuMs / matchs,
    modele,
  }
}

// ---------- display ----------

const MINUTE = 60_000

/** Round to the nearest 5 minutes — a to-the-minute estimate would be a lie. */
function arrondi5(ms: number): number {
  return Math.round(ms / (5 * MINUTE)) * 5 * MINUTE
}

/**
 * « 45 min », « 1 h 25 », « 2 h ». Rounded to 5 minutes, and never « 0 min »:
 * anything shorter reads as « ~5 min ».
 */
export function formatDuree(ms: number): string {
  const total = Math.max(5 * MINUTE, arrondi5(ms))
  const minutes = Math.round(total / MINUTE)
  const heures = Math.floor(minutes / 60)
  const reste = minutes % 60
  if (heures === 0) return `${reste} min`
  return reste === 0 ? `${heures} h` : `${heures} h ${String(reste).padStart(2, '0')}`
}

/**
 * The finish time for a start entered as « HH:MM », in the French idiom
 * (« 18 h 40 »). Null when no valid start time was given; wraps past midnight
 * rather than reporting a 25th hour.
 */
export function heureDeFin(heure: string, ms: number): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(heure.trim())
  if (m === null) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  const total = Math.round((h * 60 + min + arrondi5(ms) / MINUTE) % (24 * 60))
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')}`
}

/** Everything the rail card prints, so the component holds no wording. */
export interface ResumeDuree {
  titre: string
  fourchette: string
  detail: string
  fin: string | null
  source: string
}

/** The « Durée estimée » card: headline, band, per-match detail, and what it rests on. */
export function resumeDuree(estimation: EstimationDuree, heure: string): ResumeDuree {
  const { modele, matchs } = estimation
  const parMatch = Math.max(1, Math.round(estimation.parMatchMs / MINUTE))
  const entracte = Math.round(modele.entracteMs / MINUTE)
  const detail =
    matchs === 1
      ? `1 match · ~${parMatch} min`
      : `${matchs} matchs · ~${parMatch} min par match · ~${entracte} min entre deux`
  return {
    titre: `≈ ${formatDuree(estimation.totalMs)}`,
    fourchette: `entre ${formatDuree(estimation.basMs)} et ${formatDuree(estimation.hautMs)}`,
    detail,
    fin: heureDeFin(heure, estimation.totalMs),
    source: modele.parDefaut
      ? 'estimation de départ — pas encore assez de matchs chronométrés'
      : `d’après ${modele.echantillon} matchs chronométrés`,
  }
}
