import { libelleFormat } from './format'
import { isPlayable, roundLabel } from './doubleElim'
import { computeStandings, matchDuration } from './pingpong'
import type { TournamentRating } from '../hooks/useRatingDeltas'
import { BYE, TBD } from '../types'
import type { Bracket, Match, StandingRow, Tournament } from '../types'

/** The three derived pieces of the tournament board's page header. */
export interface EnteteTournoi {
  /** « Round-robin · 5 joueurs · jeu en 11 » */
  kicker: string
  /** What to do on this page, plus the Elo caveat when the tournament is unranked. */
  sousTitre: string
  /** Drives the « Non classé » badge beside the title. */
  nonClasse: boolean
}

/**
 * `unranked` is optional here on purpose: rows created before the unranked
 * migration have no such column, and readers treat missing as false.
 */
type EnteteSource = Pick<Tournament, 'kind' | 'format' | 'doubles' | 'players' | 'target'> & {
  unranked?: boolean
}

const CONSIGNE_ROUND_ROBIN = 'Tape un match pour ouvrir le marqueur. Tout se synchronise en direct.'
const CONSIGNE_DOUBLE_ELIM =
  'Le gagnant avance, le perdant tombe dans le tableau des perdants. Tape un match prêt pour le marquer.'
const CAVEAT_NON_CLASSE = 'Aucun impact sur le classement Elo.'

/**
 * Header model for the tournament board. The format label comes from
 * `libelleFormat` so the board says the same thing as Parties, Home and the
 * scorer subtitle — the design handoff's « Double élimination » was declined in
 * favour of the app-wide « Élimination directe ».
 */
export function enteteTournoi(tournoi: EnteteSource): EnteteTournoi {
  const nonClasse = tournoi.unranked ?? false
  const consigne = tournoi.format === 'double_elim' ? CONSIGNE_DOUBLE_ELIM : CONSIGNE_ROUND_ROBIN

  return {
    kicker: `${libelleFormat(tournoi)} · ${tournoi.players.length} joueurs · jeu en ${tournoi.target}`,
    sousTitre: nonClasse ? `${consigne} ${CAVEAT_NON_CLASSE}` : consigne,
    nonClasse,
  }
}

/** Where a round-robin match stands, as shown beside its status dot. */
export type EtatMatch = 'Terminé' | 'En cours' | 'À jouer'

/**
 * A match counts as under way as soon as either side has scored — the scorer
 * writes points before the match is validated, so a non-zero score is the only
 * signal that someone is at the table.
 */
export function etatMatch(match: Pick<Match, 'done' | 'score_a' | 'score_b'>): EtatMatch {
  if (match.done) return 'Terminé'
  return match.score_a > 0 || match.score_b > 0 ? 'En cours' : 'À jouer'
}

/** One « Tour N » block: its matches, plus whoever sits the round out. */
export interface TourDuTournoi {
  round: number
  matches: Match[]
  /** Players not scheduled this round — « exempt : Candice ». Empty on even counts. */
  exempts: string[]
}

/** Matches grouped into rounds, in playing order, each knowing who is exempt. */
export function toursDuTournoi(
  tournoi: Pick<Tournament, 'players'>,
  matches: Match[],
): TourDuTournoi[] {
  const parTour = new Map<number, Match[]>()
  for (const match of matches) {
    parTour.set(match.round, [...(parTour.get(match.round) ?? []), match])
  }

  return [...parTour.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, items]) => {
      const alaTable = new Set(items.flatMap((m) => [m.player_a, m.player_b]))
      return {
        round,
        matches: items,
        exempts: tournoi.players.filter((joueur) => !alaTable.has(joueur)),
      }
    })
}

/** « 6/10 joués » and the progress bar's fill. */
export interface Avancement {
  joues: number
  total: number
  /** 0 → 1. Zero on an empty schedule rather than NaN. */
  ratio: number
}

export function avancement(matches: Match[]): Avancement {
  const total = matches.length
  const joues = matches.filter((match) => match.done).length
  return { joues, total, ratio: total === 0 ? 0 : joues / total }
}

export interface DureeMatch {
  match: Match
  ms: number
}

/** « Plus long : X–Y (mm:ss) · Plus court : X–Y (mm:ss) ». */
export interface ExtremesDuree {
  plusLong: DureeMatch
  plusCourt: DureeMatch
}

/**
 * The longest and shortest *timed* matches. A match still under way has no end
 * time and would otherwise be measured against the clock, so only finished
 * matches with both timestamps count. Ties keep the first match played.
 */
export function extremesDuree(matches: Match[]): ExtremesDuree | null {
  const chronometres = matches.flatMap((match) => {
    const ms = dureeTerminee(match)
    return ms === null ? [] : [{ match, ms }]
  })

  if (chronometres.length === 0) return null

  return {
    plusLong: chronometres.reduce((max, item) => (item.ms > max.ms ? item : max)),
    plusCourt: chronometres.reduce((min, item) => (item.ms < min.ms ? item : min)),
  }
}

/**
 * How long a match actually took, or null when that cannot be known: still
 * under way, never validated, or missing a timestamp. Guarding on both
 * timestamps matters because `matchDuration` measures an unfinished match
 * against the clock, which would report an ever-growing duration.
 */
export function dureeTerminee(match: Match): number | null {
  if (!match.done || match.started_at === null || match.ended_at === null) return null
  return matchDuration(match)
}

/** A player's Elo movement across this tournament, rounded for display. */
export interface EloTournoi {
  net: number
  depart: number
  arrivee: number
}

/** One row of the board's « Classement » card. */
export interface LigneClassement extends StandingRow {
  rang: number
  /** null when the player has no rating event in this tournament. */
  elo: EloTournoi | null
}

export interface Classement {
  rows: LigneClassement[]
  /** The ÉLO column is dropped whenever it would say nothing true. */
  afficherElo: boolean
  /** Shown under the card in place of the column, on unranked tournaments. */
  note: string | null
}

const NOTE_NON_CLASSE = 'Tournoi non classé — les résultats ne changent aucun Elo.'

/**
 * The board's standings, derived from played matches — never stored. Ordering
 * (wins, then point difference) comes from `computeStandings`, so the card and
 * the champion screen always agree.
 *
 * An unranked tournament moves no Elo, so showing the column would imply an
 * effect that does not exist: it is hidden and replaced by a note.
 */
export function lignesClassement({
  players,
  matches,
  ratings,
  unranked,
}: {
  players: string[]
  matches: Match[]
  ratings: TournamentRating[]
  unranked: boolean
}): Classement {
  const parNom = new Map(ratings.map((rating) => [rating.name, rating]))

  const rows = computeStandings(players, matches).map((standing, index) => {
    const rating = parNom.get(standing.name)
    return {
      ...standing,
      rang: index + 1,
      elo: rating
        ? {
            net: Math.round(rating.netDelta),
            depart: Math.round(rating.startRating),
            arrivee: Math.round(rating.endRating),
          }
        : null,
    }
  })

  return {
    rows,
    afficherElo: !unranked && ratings.length > 0,
    note: unranked ? NOTE_NON_CLASSE : null,
  }
}

/** How a bracket slot reads when the player filling it is not yet known. */
export function nomAdversaire(nom: string): string {
  if (nom === TBD) return 'À déterminer'
  if (nom === BYE) return 'Bye'
  return nom
}

/**
 * Where a bracket node stands. « En attente » is the one the round-robin list
 * has no equivalent for: the match exists, but a feeder result is missing, so
 * it cannot be played yet.
 */
export type EtatNoeud = 'Terminé' | 'En cours' | 'Prêt' | 'En attente'

export function etatNoeud(match: Match): EtatNoeud {
  if (match.done) return 'Terminé'
  if (match.score_a > 0 || match.score_b > 0) return 'En cours'
  return isPlayable(match) ? 'Prêt' : 'En attente'
}

/**
 * Auto-completed walkovers are not games anyone plays, so they are hidden from
 * the bracket and left out of the progress count.
 */
export function noeudsVisibles(matches: Match[]): Match[] {
  return matches.filter((match) => !match.bye)
}

/** One round of a bracket group, rendered as a column. */
export interface ColonneTableau {
  titre: string
  noeuds: Match[]
}

export type GroupeId = 'principal' | 'perdants' | 'finale'

export interface GroupeTableau {
  groupe: GroupeId
  titre: string
  colonnes: ColonneTableau[]
}

const TITRE_GROUPE: Record<GroupeId, string> = {
  principal: 'Tableau principal',
  perdants: 'Tableau des perdants',
  finale: 'Grande finale',
}

const ORDRE_GROUPES: Array<[GroupeId, Bracket]> = [
  ['principal', 'W'],
  ['perdants', 'L'],
  ['finale', 'GF'],
]

const dernierTour = (matches: Match[], bracket: Bracket): number =>
  matches
    .filter((match) => match.bracket === bracket)
    .reduce((max, match) => Math.max(max, match.round), 0)

function colonnesDe(
  matches: Match[],
  bracket: Bracket,
  maxW: number,
  maxL: number,
): ColonneTableau[] {
  const parTour = new Map<number, Match[]>()
  for (const match of matches) {
    if (match.bracket !== bracket) continue
    parTour.set(match.round, [...(parTour.get(match.round) ?? []), match])
  }

  return [...parTour.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, noeuds]) => ({
      titre: roundLabel(bracket, round, maxW, maxL),
      noeuds: [...noeuds].sort((x, y) => x.idx - y.idx),
    }))
}

/**
 * The bracket as three stacked groups of round columns. A group with no nodes
 * is dropped rather than rendered empty — a 3-player bracket has no losers
 * final, and the grande finale does not exist until it is generated.
 */
export function groupesTableau(matches: Match[]): GroupeTableau[] {
  const visibles = noeudsVisibles(matches)
  const maxW = dernierTour(visibles, 'W')
  const maxL = dernierTour(visibles, 'L')

  return ORDRE_GROUPES.flatMap(([groupe, bracket]) => {
    const colonnes = colonnesDe(visibles, bracket, maxW, maxL)
    return colonnes.length === 0 ? [] : [{ groupe, titre: TITRE_GROUPE[groupe], colonnes }]
  })
}
