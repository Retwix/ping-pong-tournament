import { libelleFormat } from './format'
import type { Tournament } from '../types'

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
